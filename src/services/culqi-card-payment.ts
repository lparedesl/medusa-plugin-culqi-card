import {
  AbstractPaymentService,
  PaymentContext,
  Data,
  Payment,
  PaymentSession,
  PaymentSessionStatus,
  PaymentSessionData,
  Cart,
  PaymentData,
  PaymentSessionResponse,
  Address,
  Customer,
  CustomerService,
  CartService,
} from '@medusajs/medusa';
import { PaymentProcessorSessionResponse } from '@medusajs/medusa/dist/interfaces/payment-processor';
import { MedusaError } from 'medusa-core-utils';
import { EntityManager } from 'typeorm';
import CulqiLogService from './culqi-log';
import {
  AntifraudDetails,
  ChargeCreatePayload,
  Customer as CulqiCustomer,
  CustomerUpdatePayload,
  Error, RefundCreatePayload, RefundReason,
} from '../types/culqi';
import CulqiClient from '../helpers/culqi-client';
import {
  FindCustomerOptions,
  getOrCreateCulqiCustomer,
  getChargeAntiFraudDetails,
  createCard,
} from '../helpers/culqi';

type InjectedDependencies = {
  manager: EntityManager
  customerService: CustomerService
  cartService: CartService
  culqiLogService: CulqiLogService
}

type UpdatePaymentData = Data & {
  same_as_shipping_address: boolean,
  billing_address?: Address,
  card_id?: string,
  card_token?: string,
  save_card?: boolean,
};

class CulqiCardPaymentService extends AbstractPaymentService {
  protected readonly customerService_: CustomerService;
  protected readonly cartService_: CartService;
  protected readonly culqiClient_: CulqiClient;
  protected readonly capture_: boolean;

  protected readonly manager_: EntityManager;
  protected readonly transactionManager_: EntityManager | undefined;

  protected static identifier: string = 'culqi_card';

  constructor({
    manager,
    customerService,
    cartService,
    culqiLogService,
  }: InjectedDependencies, options) {
    super(arguments[0]);

    this.manager_ = manager;
    this.customerService_ = customerService;
    this.cartService_ = cartService;
    this.culqiClient_ = new CulqiClient(culqiLogService);

    this.capture_ = process.env.CULQI_CAPTURE === 'true';
  }

  /**
   * initiate payment
   * @summary This method is called during checkout when Payment Sessions are initialized to present payment options to the customer. It is used to allow you to make any necessary calls to the third-party provider to initialize the payment.
   * @param {Cart & PaymentContext} context - The context of the payment
   * @returns {Promise} - The result of the operation
   */
  async createPayment(context: Cart & PaymentContext): Promise<PaymentProcessorSessionResponse> {
    const { customer, cart, currency_code, amount } = context;
    const { email, shipping_address } = cart;
    const sessionData: Record<string, unknown> = {
      currency: currency_code,
      amount,
      email,
      customer,
      shipping_address: shipping_address,
      antifraud_details: getChargeAntiFraudDetails({
        address: shipping_address,
        customer,
        customerTakesPriority: true,
      }),
      is_recurring_order: context.context.isRecurringOrder,
    };
    const customerMetadata: Record<string, unknown> = {};

    const findOptions: FindCustomerOptions = {
      culqiClient: this.culqiClient_,
      customer,
      email,
      address: shipping_address,
    };
    const [culqiCustomerId, _, error] = await getOrCreateCulqiCustomer(findOptions);

    if (error) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.merchant_message);
    }

    sessionData.customer_id = culqiCustomerId;

    // if needed, save new Culqi customer id in customer metadata
    if (!customer?.metadata?.culqi_customer_id) {
      customerMetadata.culqi_customer_id = culqiCustomerId;
    }

    return {
      update_requests: {
        customer_metadata: customerMetadata,
      },
      session_data: sessionData,
    };
  }

  /**
   * update payment data
   * @summary This method is used to update the data field of a Payment Session. Particularly, it is called when a request is sent to the Update Payment Session endpoint. This endpoint receives a data object in the body of the request that should be used to update the existing data field of the Payment Session.
   * @param {PaymentSessionData} paymentSessionData - The data of the payment session
   * @param {Data} data - The data to update the payment session with
   * @returns {Promise} - The result of the operation
   */
  async updatePaymentData(
    paymentSessionData: PaymentSessionData,
    data: UpdatePaymentData,
  ): Promise<PaymentSessionData> {
    const {
      same_as_shipping_address,
      billing_address,
      card_id,
      card_token,
      save_card,
    } = data;
    const culqiCustomerId = paymentSessionData.customer_id as string;
    const isRecurringOrder = paymentSessionData.is_recurring_order as boolean;
    const antifraudDetailsFromBillingAddress = paymentSessionData.antifraud_details_from_billing_address as boolean;
    const customer = paymentSessionData.customer as Customer;
    const shippingAddress = paymentSessionData.shipping_address as Address;
    const billingAddress = same_as_shipping_address ? shippingAddress : billing_address;
    const updatedSessionData = { ...paymentSessionData };
    let updatedCulqiCustomer = false;
    let lastUsedCardId: string;
    const promises = [];

    if (!card_id && !card_token) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Card id or card token is required');
    }

    if (!same_as_shipping_address && !billing_address) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Billing address is required');
    }

    if (isRecurringOrder && !card_id && !save_card) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Saving a card is required for recurring orders');
    }

    /*
    * this condition is only met when billing address is
    * different from shipping address, or the billing address
    * is set back to the shipping address after being set to
    * a different address
    * */
    if (!same_as_shipping_address || antifraudDetailsFromBillingAddress) {
      /*
      * update anti-fraud details if billing address is updated
      * */
      updatedSessionData.antifraud_details = getChargeAntiFraudDetails({
        address: billingAddress,
      });
      updatedSessionData.antifraud_details_from_billing_address = !same_as_shipping_address;

      /*
      * if guest customer and billing address is updated,
      * then update Culqi customer with billing address info
      * */
      if (!customer?.has_account) {
        const updateCustomerRequest: CustomerUpdatePayload = {
          first_name: billingAddress.first_name,
          last_name: billingAddress.last_name,
          address: billingAddress.address_1,
          address_city: billingAddress.city,
          country_code: billingAddress.country_code,
          phone_number: billingAddress.phone,
        };
        updatedCulqiCustomer = true;
        promises.push(this.culqiClient_.updateCustomerAsync(culqiCustomerId, updateCustomerRequest));
      }
    }

    if (card_id) {
      updatedSessionData.source_id = card_id;
      lastUsedCardId = card_id;
    } else if (save_card) {
      const cardId = await createCard({
        culqiClient: this.culqiClient_,
        customerId: culqiCustomerId,
        cardToken: card_token,
        billingAddress,
      });

      updatedSessionData.source_id = cardId;
      lastUsedCardId = cardId;
    } else {
      updatedSessionData.source_id = card_token;
    }

    // update customer's last used card id
    if (lastUsedCardId && customer) {
      promises.push(this.customerService_.update(customer.id, {
        metadata: {
          ...customer.metadata,
          last_used_culqi_card_id: lastUsedCardId,
        },
      }));
    }

    const responses = await Promise.allSettled(promises);

    responses.forEach((response, idx) => {
      if (updatedCulqiCustomer && idx === 0) {
        let updateCulqiCustomerSuccessful = false;

        if (response.status === 'fulfilled') {
          const [_, error] = response.value as [CulqiCustomer, Error];
          updateCulqiCustomerSuccessful = !error;
        }

        if (!updateCulqiCustomerSuccessful) {
          /*
          * continue with the flow, but log the error
          * about Culqi customer not being updated
          * */
        }
      } else {
        if (response.status === 'rejected') {
          /*
          * continue with the flow, but log the error
          * about customer's last used card id not being updated
          * */
        }
      }
    });

    return updatedSessionData;
  }

  /**
   * update payment
   * @summary This method is used to perform any necessary updates on the payment. This method is called whenever the cart or any of its related data is updated. For example, when a line item is added to the cart or when a shipping method is selected.
   * @param {PaymentSessionData} paymentSessionData - The data of the payment session
   * @param {Cart & PaymentContext} context - The context of the payment
   * @returns {Promise} - The result of the operation
   */
  async updatePayment(
    paymentSessionData: PaymentSessionData,
    context: Cart & PaymentContext,
  ): Promise<PaymentSessionResponse | PaymentSessionResponse['session_data']> {
    const oldEmail = paymentSessionData.email as string;
    const oldCustomer = paymentSessionData.customer as Customer;
    const { customer, cart, currency_code, amount } = context;
    const { email, shipping_address } = cart;

    const updatedSessionData: PaymentSessionData = {
      ...paymentSessionData,
      currency: currency_code,
      amount,
      email,
      customer,
      shipping_address,
      antifraud_details: getChargeAntiFraudDetails({
        address: shipping_address,
        customer,
        customerTakesPriority: true,
      }),
      antifraud_details_from_billing_address: false,
      is_recurring_order: context.context.isRecurringOrder,
    };

    // if email or customer have changed, update Culqi customer id
    if (oldEmail !== email || oldCustomer?.id !== customer?.id) {
      const findOptions: FindCustomerOptions = {
        culqiClient: this.culqiClient_,
        customer,
        email,
        address: shipping_address,
      };
      const [culqiCustomerId, _, error] = await getOrCreateCulqiCustomer(findOptions);

      if (error) {
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.merchant_message);
      }

      updatedSessionData.customer_id = culqiCustomerId;

      if (customer) {
        customer.metadata = {
          ...(customer.metadata || {}),
          culqi_customer_id: culqiCustomerId,
        };
        updatedSessionData.customer = customer;
      }

      /*
      * At this stage, the new customer does not exist yet in the database.
      * Subscriber will handle saving the Culqi customer id in the customer metadata.
      * */

      // remove newly created customer (from previous payment session)
      if (oldCustomer && !oldCustomer.has_account) {
        const oldCulqiCustomerId = oldCustomer.metadata?.culqi_customer_id as string;

        if (oldCulqiCustomerId) {
          await this.culqiClient_.deleteCustomerAsync(oldCulqiCustomerId);
        }
      }
    }

    return updatedSessionData;
  }

  /**
   * authorize payment
   * @summary This method is used to authorize payment using the Payment Session for an order. This is called when the cart is completed and before the order is created.
   * @param {PaymentSession} paymentSession - The payment session to authorize
   * @param {Data} context - The context of the payment
   * @returns {Promise} - The result of the operation
   */
  async authorizePayment(
    paymentSession: PaymentSession,
    context: Data,
  ): Promise<{ data: PaymentSessionData; status: PaymentSessionStatus; }> {
    const currency = paymentSession.data.currency as string;
    const email = paymentSession.data.email as string;
    const antifraudDetails = paymentSession.data.antifraud_details as AntifraudDetails;
    const sourceId = paymentSession.data.source_id as string;
    const isRecurringOrder = paymentSession.data.is_recurring_order as boolean;
    const cart = await this.cartService_.retrieve(paymentSession.cart_id, {
      relations: ['items'],
    });
    // TODO: check how to handle renewal orders or product-only changes (recurring orders)
    const lineItems = cart.items.map((item) => {
      return {
        id: item.variant.product_id,
        name: item.title,
        quantity: item.quantity,
        price: item.unit_price / 100,
      };
    });
    const chargeMetadata: Record<string, unknown> = {
      lineItems,
    };
    const chargeRequest: ChargeCreatePayload = {
      amount: paymentSession.amount,
      currency_code: currency.toUpperCase(),
      capture: this.capture_,
      description: `Medusa Order for cart ${paymentSession.cart_id}`,
      email,
      antifraud_details: antifraudDetails,
      source_id: sourceId,
      metadata: chargeMetadata,
    };
    const paymentSessionData: PaymentSessionData = {};
    let paymentSessionStatus = PaymentSessionStatus.PENDING;

    const [charge, error] = await this.culqiClient_.createChargeAsync(chargeRequest);

    if (error) {
      if (isRecurringOrder) {
        paymentSessionData.recurring_payment_failed = true;
      }

      paymentSessionData.outcome_type = 'error';
      paymentSessionStatus = PaymentSessionStatus.ERROR;
    } else {
      paymentSessionData.charge_id = charge.id;
      paymentSessionData.outcome_type = charge.outcome.type;
      paymentSessionData.reference_code = charge.reference_code;

      if (charge.outcome.type === 'venta_exitosa') {
        paymentSessionData.authorization_code = charge.authorization_code;
        paymentSessionData.authorization_result = charge.outcome.merchant_message;

        if (charge.capture) {
          paymentSessionData.capture_result = charge.outcome.merchant_message;
        }

        paymentSessionStatus = PaymentSessionStatus.AUTHORIZED;
      }
    }

    return {
      data: paymentSessionData,
      status: paymentSessionStatus,
    };
  }

  /**
   * get payment data
   * @summary After the payment is authorized using authorizePayment, a Payment instance will be created. The data field of the Payment instance will be set to the value returned from the getPaymentData method in the Payment Provider.
   * @param {PaymentSession} paymentSession - The payment session to get data for
   * @returns {Promise} - The result of the operation
   */
  async getPaymentData(paymentSession: PaymentSession): Promise<PaymentData> {
    return {
      charge_id: paymentSession.data.charge_id,
      outcome_type: paymentSession.data.outcome_type,
      reference_code: paymentSession.data.reference_code,
      authorization_code: paymentSession.data.authorization_code,
      authorization_result: paymentSession.data.authorization_result,
      capture_result: paymentSession.data.capture_result,
    };
  }

  /**
   * capture payment
   * @summary This method is used to capture the payment amount of an order. This is typically triggered manually by the store operator from the admin.
   * @param {Payment} payment - The payment to capture
   * @returns {Promise} - The result of the operation
   */
  async capturePayment(payment: Payment): Promise<PaymentData> {
    const chargeId = payment.data.charge_id as string;
    const [charge, error] = await this.culqiClient_.captureChargeAsync(chargeId);

    if (error) {
      if (error.type === 'parameter_error') {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Charge not found');
      }

      if (error.type === 'authentication_error') {
        throw new MedusaError(MedusaError.Types.UNAUTHORIZED, 'Invalid Culqi API Key');
      }

      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Error capturing charge: ${chargeId}`);
    }

    const updatedPaymentData: PaymentData = {
      ...payment.data,
    };

    if (charge.outcome.type === 'venta_exitosa') {
      updatedPaymentData.capture_result = charge.outcome.merchant_message;
    }

    return updatedPaymentData;
  }

  /**
   * refund payment
   * @summary This method is used to refund an order’s payment. This is typically triggered manually by the store operator from the admin. The refund amount might be the total order amount or part of it.
   * @param {Payment} payment - The payment to refund
   * @param {number} refundAmount - The amount to refund
   * @returns {Promise} - The result of the operation
   */
  async refundPayment(payment: Payment, refundAmount: number): Promise<PaymentData> {
    const chargeId = payment.data.charge_id as string;
    const createRefundRequest: RefundCreatePayload = {
      amount: refundAmount,
      charge_id: chargeId,
      reason: RefundReason.REQUESTED_BY_CUSTOMER,
    };
    const [_, error] = await this.culqiClient_.createRefundAsync(createRefundRequest);

    if (error) {
      if (error.type === 'parameter_error') {
        if (error.param === 'charge_id') {
          throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Charge not found');
        }

        if (error.param === 'amount') {
          throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Amount cannot be greater than the remaining amount');
        }
      }

      if (error.type === 'authentication_error') {
        throw new MedusaError(MedusaError.Types.UNAUTHORIZED, 'Invalid Culqi API Key');
      }

      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Error refunding charge: ${chargeId}`);
    }

    return {
      ...payment.data,
    };
  }

  /**
   * cancel payment
   * @summary This method is used to cancel an order’s payment. This method is typically triggered by one of the following situations:
   *
   * 1. Before an order is placed and after the payment is authorized, an inventory check is done on products to ensure that products are still available for purchase. If the inventory check fails for any of the products, the payment is canceled.
   * 2. If the store operator cancels the order from the admin.
   * @param {Payment} payment - The payment to cancel
   * @returns {Promise} - The result of the operation
   */
  async cancelPayment(payment: Payment): Promise<PaymentData> {
    return payment.data;
  }

  /**
   * retrieve payment
   * @summary This method is used to provide a uniform way of retrieving the payment information from the third-party provider.
   * @param {PaymentData} paymentData - The payment data to retrieve
   * @returns {Promise} - The result of the operation
   */
  async retrievePayment(paymentData: PaymentData): Promise<Data> {
    const chargeId = paymentData.charge_id as string;
    const [charge, error] = await this.culqiClient_.getChargeAsync(chargeId);

    if (error) {
      if (error.type === 'parameter_error') {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Charge not found');
      }

      if (error.type === 'authentication_error') {
        throw new MedusaError(MedusaError.Types.UNAUTHORIZED, 'Invalid Culqi API Key');
      }

      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Error retrieving charge: ${chargeId}`);
    }

    return charge;
  }

  /**
   * get status
   * @summary This method is used to get the status of a Payment or a Payment Session.
   * This method returns a string that represents the status. The status must be one of the following values:
   *
   * - authorized: The payment was successfully authorized.
   * - pending: The payment is still pending. This is the default status of a Payment Session.
   * - requires_more: The payment requires more actions from the customer. For example, if the customer must complete a 3DS check before the payment is authorized.
   * - error: If an error occurred with the payment.
   * - canceled: If the payment was canceled.
   * @param {Data} data - The data to get the status for
   * @returns {Promise} - The result of the operation
   */
  async getStatus(data: Data): Promise<PaymentSessionStatus> {
    const outcomeType = data.outcome_type as string;

    if (outcomeType === 'error') {
      return PaymentSessionStatus.ERROR;
    }

    if (outcomeType === 'venta_exitosa') {
      return PaymentSessionStatus.AUTHORIZED;
    }

    return PaymentSessionStatus.PENDING;
  }

  /**
   * delete payment
   * @summary This method is used to perform any actions necessary before a Payment Session is deleted. The Payment Session is deleted in one of the following cases:
   *
   * 1. When a request is sent to delete the Payment Session.
   * 2. When the Payment Session is refreshed. The Payment Session is deleted so that a newer one is initialized instead.
   * 3. When the Payment Provider is no longer available. This generally happens when the store operator removes it from the available Payment Provider in the admin.
   * 4. When the region of the store is changed based on the cart information and the Payment Provider is not available in the new region.
   * @param {PaymentSession} paymentSession - The payment session to delete
   * @returns {Promise} - The result of the operation
   */
  async deletePayment(paymentSession: PaymentSession): Promise<void> {
  }
}

export default CulqiCardPaymentService;
