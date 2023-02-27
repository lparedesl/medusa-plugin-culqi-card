import { Customer, CustomerService } from '@medusajs/medusa';
import { MedusaError } from 'medusa-core-utils';
import CulqiClient from '../helpers/culqi-client';
import { getOrCreateCulqiCustomer } from '../helpers/culqi';
import { CustomerUpdatePayload } from '../types/culqi';

class CulqiCustomerSubscriber {
  protected readonly customerService_: CustomerService;
  protected readonly culqiClient_: CulqiClient;

  constructor({ eventBusService, customerService, culqiLogService }) {
    this.customerService_ = customerService;
    this.culqiClient_ = new CulqiClient(culqiLogService);

    eventBusService.subscribe('customer.created', this.handleNewCustomer);
    eventBusService.subscribe('customer.updated', this.handleUpdatedCustomer);
    eventBusService.subscribe('customer.deleted', this.handleDeletedCustomer);
  }

  handleNewCustomer = async (customer: Customer) => {
    const [culqiCustomerId, _, error] = await getOrCreateCulqiCustomer({
      culqiClient: this.culqiClient_,
      customer: customer,
      email: customer.email,
      address: null,
    });

    if (error) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Failed to create Culqi customer with error: ${error.merchant_message}`, error.code);
    }

    await this.customerService_.update(customer.id, {
      metadata: {
        ...(customer.metadata || {}),
        culqi_customer_id: culqiCustomerId,
      },
    });
  };

  handleUpdatedCustomer = async (customer: Customer) => {
    const culqiCustomerId = customer.metadata?.culqi_customer_id as string;
    const isCompany = customer.metadata?.is_company as boolean;

    if (culqiCustomerId) {
      const updateData: CustomerUpdatePayload = {};

      if (!isCompany) {
        if (customer.first_name) {
          updateData.first_name = customer.first_name;
        }
        if (customer.last_name) {
          updateData.last_name = customer.last_name;
        }
        if (customer.phone) {
          updateData.phone_number = customer.phone;
        }
      } else {
        if (customer.first_name && customer.metadata?.external_user_id) {
          updateData.metadata = {
            external_user_id: customer.metadata.external_user_id as string | number,
            company_name: customer.first_name,
          };
        }
      }

      if (!Object.keys(updateData).length) {
        return;
      }

      const [_, error] = await this.culqiClient_.updateCustomerAsync(culqiCustomerId, updateData);

      if (error) {
        // continue with the flow, but log the error
      }
    }
  };

  handleDeletedCustomer = async (customer: Customer) => {
    const culqiCustomerId = customer.metadata?.culqi_customer_id as string;

    if (culqiCustomerId) {
      const [deleted, error] = await this.culqiClient_.deleteCustomerAsync(culqiCustomerId);

      if (error || !deleted) {
        // continue with the flow, but log the error
      }
    }
  };
}

export default CulqiCustomerSubscriber;
