import CulqiClient from './culqi-client';
import {
  AntifraudDetails,
  CardCreatePayload,
  CardMetadata,
  CustomerCreatePayload,
  CustomerMetadata,
  Error,
} from '../types/culqi';
import { Address, Customer } from '@medusajs/medusa';
import { MedusaError } from 'medusa-core-utils';

export type FindCustomerOptions = {
  culqiClient: CulqiClient;
  customer?: Customer;
  email: string;
  address: Address | null;
};

export type AntifraudDetailsPayload = {
  address?: Address;
  customer?: Customer;
  customerTakesPriority?: boolean;
};

export type CreateCardPayload = {
  culqiClient: CulqiClient;
  customerId: string;
  cardToken: string;
  billingAddress: Address;
};

export const randomDigits = (length) => {
  let result = '';
  const characters = '0123456789';
  const charactersLength = characters.length;
  let counter = 0;

  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }

  return result;
};

export const getCulqiName = (name: string): string => {
  return name?.trim().replace(/\./g, '') ?? '';
};

export const getChargeAntiFraudDetails = ({
  address,
  customer,
  customerTakesPriority,
}: AntifraudDetailsPayload): Omit<AntifraudDetails, 'object'> => {
  const data = {
    first_name: '',
    last_name: '',
    phone_number: '',
    address: address?.address_1 ?? 'Placeholder',
    address_city: address?.city ?? 'Placeholder',
    country_code: address?.country_code?.toUpperCase() ?? 'PE',
  };

  if (customerTakesPriority) {
    data.first_name = customer?.first_name ?? address?.first_name ?? 'Nombre';
    data.last_name = customer?.last_name ?? address?.last_name ?? 'Apellido';
    data.phone_number = (customer?.phone ?? address?.phone ?? '') || randomDigits(9);
  } else {
    data.first_name = address?.first_name ?? customer?.first_name ?? 'Nombre';
    data.last_name = address?.last_name ?? customer?.last_name ?? 'Apellido';
    data.phone_number = (address?.phone ?? customer?.phone ?? '') || randomDigits(9);
  }

  return data;
};

export const getOrCreateCulqiCustomer = async ({
  culqiClient,
  customer,
  email,
  address,
}: FindCustomerOptions): Promise<[string, boolean, Error]> => {
  let culqiCustomerId = customer?.metadata?.culqi_customer_id as string;
  let createdCustomer = false;

  // check whether customer exists
  if (!culqiCustomerId) {
    const costosUserId = customer?.metadata?.costos_user_id as number;
    const isCompany = customer?.metadata?.is_company as boolean;
    const ruc = customer?.metadata?.ruc as string;

    const metadata: CustomerMetadata = {};

    if (costosUserId) {
      metadata.IdentificadorWebId = costosUserId;
    }

    if (isCompany) {
      metadata.Nombre = customer.first_name;
    }

    // try to create the new one, if not exists
    const culqiCustomerEmail = !isCompany
      ? customer?.email ?? email
      : `costos.${ruc}@costosperu.net`;
    const culqiCustomerFirstName = !isCompany
      ? getCulqiName(customer?.first_name ?? address?.first_name)
      : 'Nombre';
    const culqiCustomeLastName = !isCompany
      ? getCulqiName(customer?.last_name ?? address?.last_name)
      : 'Apellido';
    const culqiCustomerPhone = customer?.phone ?? address?.phone ?? '';

    const customerRequest: CustomerCreatePayload = {
      email: culqiCustomerEmail.trim(),
      first_name: culqiCustomerFirstName || 'Nombre',
      last_name: culqiCustomeLastName || 'Apellido',
      phone_number: culqiCustomerPhone || randomDigits(9),
      address: address?.address_1 ?? 'Placeholder',
      address_city: address?.city ?? 'Placeholder',
      country_code: address?.country_code?.toUpperCase() ?? 'PE',
      metadata,
    };

    const [culqiCustomer, alreadyExists, error] = await culqiClient.createCustomerAsync(customerRequest);

    if (error) {
      return [null, null, error];
    }

    culqiCustomerId = culqiCustomer.id;
    createdCustomer = !alreadyExists;
  }

  return [culqiCustomerId, createdCustomer, null];
};

export const createCard = async ({
  culqiClient,
  customerId,
  cardToken,
  billingAddress,
}: CreateCardPayload): Promise<string> => {
  const cardMetadata: CardMetadata = {
    cardHolderName: `${billingAddress.first_name} ${billingAddress.last_name}`,
    billingAddress1: billingAddress.address_1,
    billingAddress2: billingAddress.address_2,
    billingCity: billingAddress.city,
    billingState: billingAddress.province,
    billingCountry: billingAddress.country_code, // TODO: Save country name?
    billingPostalCode: billingAddress.postal_code,
  };
  const createCardRequest: CardCreatePayload = {
    customer_id: customerId,
    token_id: cardToken,
    metadata: cardMetadata,
  };
  const [card, error] = await culqiClient.createCardAsync(createCardRequest);

  if (error) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.merchant_message, error.decline_code);
  }

  return card.id;
};
