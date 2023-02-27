import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { isObject } from 'lodash';
import { OperationType } from '../models/culqi-log';
import {
  Card,
  CardsListRequest,
  CardsListResponse,
  CardCreatePayload,
  CardUpdatePayload,
  Charge,
  ChargesListRequest,
  ChargesListResponse,
  ChargeCreatePayload,
  ChargeUpdatePayload,
  Customer,
  CustomersListRequest,
  CustomersListResponse,
  CustomerCreatePayload,
  CustomerUpdatePayload,
  Error,
  Order,
  OrdersListRequest,
  OrdersListResponse,
  OrderCreatePayload,
  OrderUpdatePayload,
  Refund,
  RefundsListRequest,
  RefundsListResponse,
  RefundCreatePayload,
  RefundUpdatePayload,
  Source,
} from '../types/culqi';
import { CulqiLogCreatePayload } from '../types/culqi-log';
import CulqiLogService from '../services/culqi-log';

type CulqiAxiosRequestConfig = AxiosRequestConfig & {
  operation: OperationType;
}

class CulqiClient {
  protected readonly httpInstance: AxiosInstance;
  protected readonly culqiLogService_: CulqiLogService;
  protected readonly isTestEnv_: boolean;
  protected readonly appEnv_: string;
  protected readonly devEmail_: string;
  protected readonly log_culqi_requests_: boolean;

  constructor(culqiLogService: CulqiLogService, options) {
    this.culqiLogService_ = culqiLogService;

    const { secret_key, dev_email, app_env, log_culqi_requests } = options;
    this.isTestEnv_ = secret_key.startsWith('sk_test_');
    this.appEnv_ = app_env;
    this.devEmail_ = dev_email;
    this.log_culqi_requests_ = log_culqi_requests;

    // API HTTP client
    this.httpInstance = axios.create({
      baseURL: 'https://api.culqi.com/v2',
    });
    this.httpInstance.defaults.headers.common['Authorization'] = `Bearer ${secret_key}`;
  }

  private objectToUrlSearchParams(obj: any, rootName: string = null, ignoreList: string[] = null) {
    const urlSearchParams = new URLSearchParams();

    function appendUrlSearchParams(data: any, root: string) {
      if (!ignore(root)) {
        root = root || '';
        if (Array.isArray(data)) {
          for (let i = 0; i < data.length; i++) {
            appendUrlSearchParams(data[i], root + '[' + i + ']');
          }
        } else if (typeof data === 'object' && data) {
          for (let key in data) {
            if (data.hasOwnProperty(key)) {
              if (root === '') {
                appendUrlSearchParams(data[key], key);
              } else {
                appendUrlSearchParams(data[key], root + '.' + key);
              }
            }
          }
        } else if (data !== null && typeof data !== 'undefined') {
          urlSearchParams.append(root, data);
        }
      }
    }

    function ignore(root) {
      return Array.isArray(ignoreList)
        && ignoreList.some((x) => x === root);
    }

    appendUrlSearchParams(obj, rootName);

    return urlSearchParams;
  }

  /**
   * http
   * @param {CulqiAxiosRequestConfig} axiosConfig - axios config
   * @returns {Promise} - HTTP response
   */
  private async http<T>(axiosConfig: CulqiAxiosRequestConfig): Promise<[T, Error]> {
    const { operation, ...config } = axiosConfig;
    const requestData = config.data || config.params;
    const log: CulqiLogCreatePayload = {
      tracking_id: '',
      culqi_version: '',
      operation,
      url: config.url.startsWith('/') ? config.url.substring(1) : config.url,
      request: requestData,
      response: {},
    };
    let response: AxiosResponse<string | T | Error>;
    let error: Error;

    try {
      if (config.params) {
        config.params = this.objectToUrlSearchParams(config.params);
      }

      log.start_date_utc = new Date();
      response = await this.httpInstance({
        ...config,
        headers: {
          'Accept-Encoding': 'identity',
        },
      });
    } catch (err) {
      error = {
        object: null,
        type: null,
        charge_id: null,
        code: null,
        decline_code: null,
        merchant_message: err.message,
        user_message: null,
        param: null,
      };

      if (isObject(err.response)) {
        response = err.response;
      }
    } finally {
      log.end_date_utc = new Date();

      if (response) {
        log.http_code = response.status;

        if (typeof response.data === 'string') {
          response.data = {
            object: null,
            type: null,
            charge_id: null,
            code: null,
            decline_code: null,
            merchant_message: response.data,
            user_message: 'Culqi Server Error',
            param: null,
          };
        }

        log.response = response.data || {};

        if (response.headers?.['x-culqi-tracking-id']) {
          log.tracking_id = response.headers['x-culqi-tracking-id'];
        }

        if (response.headers?.['x-culqi-version']) {
          log.culqi_version = response.headers['x-culqi-version'];
        }
      }

      if (this.log_culqi_requests_) {
        try {
          await this.culqiLogService_.create(log);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('medusa-plugin-culqi-card -- CulqiLogService.create -- error', e);
        }
      }
    }

    if (response) {
      const isSuccessStatusCode = response.status >= 200 && response.status <= 299;
      const data = response.data;

      if (isSuccessStatusCode) {
        return [data as T, null];
      }

      return [null, data as Error];
    }

    return [null, error];
  }

  // region Customers

  /**
   * get customer (async)
   * @param {string} customerId - customer id
   * @returns {object} - Response
   */
  async getCustomerAsync(customerId: string): Promise<[Customer, Error]> {
    return await this.http({
      operation: OperationType.GET_CUSTOMER,
      method: 'get',
      url: `/customers/${customerId}`,
    });
  }

  /**
   * get customers (async)
   * @param {?CustomersListRequest} [listCustomersRequest=null] - list customers request
   * @returns {object} - Response
   */
  async getCustomersAsync(listCustomersRequest: CustomersListRequest = null): Promise<[CustomersListResponse, Error]> {
    return await this.http({
      operation: OperationType.LIST_CUSTOMERS,
      method: 'get',
      url: '/customers',
      params: listCustomersRequest,
    });
  }

  /**
   * create customer (async)
   * @param {CustomerCreatePayload} customerRequest - customer request
   * @returns {object} - Response
   */
  async createCustomerAsync(customerRequest: CustomerCreatePayload): Promise<[Customer, boolean, Error]> {
    if (customerRequest.first_name.length > 50) {
      customerRequest.first_name = customerRequest.first_name.substring(0, 50);
    }

    if (customerRequest.last_name.length > 50) {
      customerRequest.last_name = customerRequest.last_name.substring(0, 50);
    }

    if (customerRequest.phone_number) {
      customerRequest.phone_number = customerRequest.phone_number.replace(/\D/g, '');

      if (customerRequest.phone_number.length > 15) {
        customerRequest.phone_number = customerRequest.phone_number.substring(0, 15);
      }
    }

    if (customerRequest.address?.length > 100) {
      customerRequest.address = customerRequest.address.substring(0, 100);
    }

    if (customerRequest.address_city?.length > 30) {
      customerRequest.address_city = customerRequest.address_city.substring(0, 30);
    }

    if (this.isTestEnv_ && this.appEnv_) {
      customerRequest.email = customerRequest.email.replace('@', `_${this.appEnv_}@`);
    }

    const [customer, error] = await this.http<Customer>({
      operation: OperationType.CREATE_CUSTOMER,
      method: 'post',
      url: '/customers',
      data: customerRequest,
    });

    if (error) {
      if (error.merchant_message === 'Un cliente esta registrado actualmente con este email.') {
        const listRequest: CustomersListRequest = { email: customerRequest.email };
        const [culqiCustomers, listError] = await this.getCustomersAsync(listRequest);

        if (listError) {
          return [null, null, listError];
        }

        return [culqiCustomers.data[0], true, null];
      }

      return [null, null, error];
    }

    return [customer, false, null];
  }

  /**
   * update customer (async)
   * @param {string} customerId - customer id
   * @param {CustomerUpdatePayload} update - customer request
   * @returns {object} - Response
   */
  async updateCustomerAsync(customerId: string, update: CustomerUpdatePayload): Promise<[Customer, Error]> {
    return await this.http({
      operation: OperationType.UPDATE_CUSTOMER,
      method: 'patch',
      url: `/customers/${customerId}`,
      data: update,
    });
  }

  /**
   * delete customer (async)
   * @param {string} customerId - customer id
   * @returns {boolean} - Response
   */
  async deleteCustomerAsync(customerId: string): Promise<[boolean, Error]> {
    const [_, error] = await this.http({
      operation: OperationType.DELETE_CUSTOMER,
      method: 'get',
      url: `/customers/${customerId}`,
    });

    if (error) {
      return [false, error];
    }

    return [true, null];
  }

  // endregion

  //region Tokens

  /**
   * get token (async)
   * @param {string} tokenId - token id
   * @returns {object} - Response
   */
  async getTokenAsync(tokenId: string): Promise<[Source, Error]> {
    return await this.http({
      operation: OperationType.GET_TOKEN,
      method: 'get',
      url: `/tokens/${tokenId}`,
    });
  }

  //endregion

  // region Cards

  /**
   * get cards (async)
   * @param {?CardsListRequest} [listCardsRequest=null] - list cards request
   * @returns {object} - Response
   */
  async getCardsAsync(listCardsRequest: CardsListRequest = null): Promise<[CardsListResponse, Error]> {
    return await this.http({
      operation: OperationType.LIST_CARDS,
      method: 'get',
      url: '/cards',
      params: listCardsRequest,
    });
  }

  /**
   * gets a cards by customer identifier (async)
   * @param {string} customerId - customer identifier
   * @returns {object} - Response
   */
  async getCardsByCustomerAsync(customerId: string): Promise<[Card[], Error]> {
    const [customer, error] = await this.getCustomerAsync(customerId);

    if (error) {
      return [null, error];
    }

    return [customer?.cards ?? [], null];
  }

  /**
   * get card (async)
   * @param {string} cardId - card identifier
   * @returns {object} - Response
   */
  async getCardAsync(cardId: string): Promise<[Card, Error]> {
    return await this.http({
      operation: OperationType.GET_CARD,
      method: 'get',
      url: `/cards/${cardId}`,
    });
  }

  /**
   * create card (async)
   * @param {CardCreatePayload} card - card request
   * @returns {object} - Response
   */
  async createCardAsync(card: CardCreatePayload): Promise<[Card, Error]> {
    return this.http({
      operation: OperationType.CREATE_CARD,
      method: 'post',
      url: '/cards',
      data: card,
    });
  }

  /**
   * update card (async)
   * @param {string} cardId - card id
   * @param {CardUpdatePayload} update - card request
   * @returns {object} - Response
   */
  async updateCardAsync(cardId: string, update: CardUpdatePayload): Promise<[Card, Error]> {
    return await this.http({
      operation: OperationType.UPDATE_CARD,
      method: 'patch',
      url: `/cards/${cardId}`,
      data: update,
    });
  }

  // endregion

  // region Charges

  /**
   * get charges (async)
   * @param {?ChargesListRequest} [listChargesRequest=null] - list charges request
   * @returns {object} - Response
   */
  async getChargesAsync(listChargesRequest: ChargesListRequest = null): Promise<[ChargesListResponse, Error]> {
    return await this.http({
      operation: OperationType.LIST_CHARGES,
      method: 'get',
      url: '/charges',
      params: listChargesRequest,
    });
  }

  /**
   * get charge (async)
   * @param {string} chargeId - charge identifier
   * @returns {object} - Response
   */
  async getChargeAsync(chargeId: string): Promise<[Charge, Error]> {
    return await this.http({
      operation: OperationType.GET_CHARGES,
      method: 'get',
      url: `/charges/${chargeId}`,
    });
  }

  /**
   * create charge (async)
   * @param {ChargeCreatePayload} charge - charge request
   * @returns {object} - Response
   */
  async createChargeAsync(charge: ChargeCreatePayload): Promise<[Charge, Error]> {
    if (charge.antifraud_details?.first_name.length > 50) {
      charge.antifraud_details.first_name = charge.antifraud_details.first_name.substring(0, 50);
    }

    if (charge.antifraud_details?.last_name.length > 50) {
      charge.antifraud_details.last_name = charge.antifraud_details.last_name.substring(0, 50);
    }

    if (charge.antifraud_details?.phone_number) {
      charge.antifraud_details.phone_number = charge.antifraud_details.phone_number.replace(/\D/g, '');

      if (charge.antifraud_details.phone_number.length > 15) {
        charge.antifraud_details.phone_number = charge.antifraud_details.phone_number.substring(0, 15);
      }
    }

    if (charge.antifraud_details?.address?.length > 100) {
      charge.antifraud_details.address = charge.antifraud_details.address.substring(0, 100);
    }

    if (charge.antifraud_details?.address_city?.length > 30) {
      charge.antifraud_details.address_city = charge.antifraud_details.address_city.substring(0, 30);
    }

    if (this.isTestEnv_ && this.devEmail_) {
      const originalEmail = charge.email;
      charge.email = this.devEmail_;

      if (!charge.metadata) {
        charge.metadata = {};
      }

      charge.metadata.originalEmail = originalEmail;

      if (this.appEnv_ ) {
        charge.metadata.env = this.appEnv_;
      }
    }

    return this.http({
      operation: OperationType.CREATE_CHARGE,
      method: 'post',
      url: '/charges',
      data: charge,
    });
  }

  /**
   * capture charge (async)
   * @param {string} chargeId - charge id
   * @returns {object} - Response
   */
  async captureChargeAsync(chargeId: string): Promise<[Charge, Error]> {
    return this.http({
      operation: OperationType.CAPTURE_CHARGE,
      method: 'post',
      url: `/charges/${chargeId}/capture`,
    });
  }

  /**
   * update charge (async)
   * @param {string} chargeId - charge id
   * @param {ChargeUpdatePayload} update - charge request
   * @returns {object} - Response
   */
  async updateChargeAsync(chargeId: string, update: ChargeUpdatePayload): Promise<[Charge, Error]> {
    return await this.http({
      operation: OperationType.UPDATE_CHARGE,
      method: 'patch',
      url: `/charges/${chargeId}`,
      data: update,
    });
  }

  // endregion

  // region Refunds

  /**
   * get refunds (async)
   * @param {?RefundsListRequest} [listRefundsRequest=null] - list refunds request
   * @returns {object} - Response
   */
  async getRefundsAsync(listRefundsRequest: RefundsListRequest = null): Promise<[RefundsListResponse, Error]> {
    return await this.http({
      operation: OperationType.LIST_REFUNDS,
      method: 'get',
      url: '/refunds',
      params: listRefundsRequest,
    });
  }

  /**
   * get refund (async)
   * @param {string} refundId - refund identifier
   * @returns {object} - Response
   */
  async getRefundAsync(refundId: string): Promise<[Refund, Error]> {
    return await this.http({
      operation: OperationType.GET_REFUND,
      method: 'get',
      url: `/refunds/${refundId}`,
    });
  }

  /**
   * create refund (async)
   * @param {RefundCreatePayload} refund - refund request
   * @returns {object} - Response
   */
  async createRefundAsync(refund: RefundCreatePayload): Promise<[Refund, Error]> {
    return this.http({
      operation: OperationType.CREATE_REFUND,
      method: 'post',
      url: '/refunds',
      data: refund,
    });
  }

  /**
   * update refund (async)
   * @param {string} refundId - refund id
   * @param {RefundUpdatePayload} update - refund request
   * @returns {object} - Response
   */
  async updateRefundAsync(refundId: string, update: RefundUpdatePayload): Promise<[Refund, Error]> {
    return await this.http({
      operation: OperationType.UPDATE_REFUND,
      method: 'patch',
      url: `/refunds/${refundId}`,
      data: update,
    });
  }

  // endregion

  // region Orders

  /**
   * get orders (async)
   * @param {?OrdersListRequest} [listOrdersRequest=null] - list orders request
   * @returns {object} - Response
   */
  async getOrdersAsync(listOrdersRequest: OrdersListRequest = null): Promise<[OrdersListResponse, Error]> {
    return await this.http({
      operation: OperationType.LIST_ORDERS,
      method: 'get',
      url: '/orders',
      params: listOrdersRequest,
    });
  }

  /**
   * get order (async)
   * @param {string} orderId - order identifier
   * @returns {object} - Response
   */
  async getOrderAsync(orderId: string): Promise<[Order, Error]> {
    return await this.http({
      operation: OperationType.GET_ORDER,
      method: 'get',
      url: `/orders/${orderId}`,
    });
  }

  /**
   * create order (async)
   * @param {OrderCreatePayload} order - order request
   * @returns {object} - Response
   */
  async createOrderAsync(order: OrderCreatePayload): Promise<[Order, Error]> {
    if (this.isTestEnv_ && this.devEmail_) {
      const originalEmail = order.client_details.email;
      order.client_details.email = this.devEmail_;

      if (!order.metadata) {
        order.metadata = {};
      }

      order.metadata.originalEmail = originalEmail;

      if (this.appEnv_) {
        order.metadata.env = this.appEnv_;
      }
    }

    return this.http({
      operation: OperationType.CREATE_ORDER,
      method: 'post',
      url: '/orders',
      data: order,
    });
  }

  /**
   * confirm order (async)
   * @param {string} orderId - order id
   * @returns {object} - Response
   */
  async confirmOrderAsync(orderId: string): Promise<[Order, Error]> {
    return this.http({
      operation: OperationType.CONFIRM_ORDER,
      method: 'post',
      url: `/orders/${orderId}/confirm`,
    });
  }

  /**
   * update order (async)
   * @param {string} orderId - order id
   * @param {OrderUpdatePayload} update - order request
   * @returns {object} - Response
   */
  async updateOrderAsync(orderId: string, update: OrderUpdatePayload): Promise<[Order, Error]> {
    return await this.http({
      operation: OperationType.UPDATE_ORDER,
      method: 'patch',
      url: `/orders/${orderId}`,
      data: update,
    });
  }

  /**
   * delete order (async)
   * @param {string} orderId - order id
   * @returns {object} - Response
   */
  async deleteOrderAsync(orderId: string): Promise<[boolean, Error]> {
    const [_, error] = await this.http({
      operation: OperationType.DELETE_ORDER,
      method: 'delete',
      url: `/orders/${orderId}`,
    });

    if (error) {
      return [false, error];
    }

    return [true, null];
  }

  // endregion
}

export default CulqiClient;
