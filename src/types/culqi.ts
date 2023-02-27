export type Cursors = {
  before: string
  after: string
}

export type Paging ={
  previous: string
  next: string
  cursors: Cursors
  remaining_items: Record<string, any>
}

export type ListRequest = {
  limit?: string
  before?: string
  after?: string
}

export type ListResponse = {
  paging: Paging
}

export type Error = {
  object: string
  type: string
  charge_id: string
  code: string
  decline_code: string
  merchant_message: string
  user_message: string
  param: string
}

export type AntifraudDetails = {
  object: string
  first_name: string
  last_name: string
  address: string
  address_city: string
  country_code: string
  phone_number: string
}

export type CustomerMetadata = {
  external_user_id?: string | number
  company_name?: string
}

export type Customer = {
  object: string
  id: string
  creation_date: number
  email: string
  antifraud_details: AntifraudDetails
  cards: Card[]
  metadata: CustomerMetadata
}

export type CustomersListRequest = ListRequest & {
  first_name?: string
  last_name?: string
  email?: string
  address?: string
  address_city?: string
  country_code?: string
  phone_number?: string
}

export type CustomersListResponse = ListResponse & {
  data: Customer[]
}

export type CustomerCreatePayload = {
  first_name: string
  last_name: string
  email: string
  address: string
  address_city: string
  country_code: string
  phone_number: string
  metadata?: CustomerMetadata
}

export type CustomerUpdatePayload = {
  first_name?: string
  last_name?: string
  address?: string
  address_city?: string
  country_code?: string
  phone_number?: string
  metadata?: CustomerMetadata
}

export type Issuer = {
  name: string
  country: string
  country_code: string
  website: string
  phone_number: string
}

export type Iin = {
  object: string
  bin: string
  card_brand: string
  card_type: string
  card_category: string
  issuer: Issuer
  installments_allowed: number[]
}

export type Client = {
  ip: string
  ip_country: string
  ip_country_code: string
  browser: string
  device_fingerprint: string
  device_type: string
}

export type Metadata = {
  method: string
  client_ip: string
  secure: string
  url: string
}

export type Source = {
  object: string
  id: string
  type: string
  creation_date: number
  email: string
  card_number: string
  last_four: string
  active: boolean
  iin: Iin
  client: Client
  metadata: Metadata
}

export type Outcome = {
  type: string
  code: string
  merchant_message: string
  user_message: string
}

export type FixedFee = {
  amount: number
  currency_code: string
  exchange_rate: number
  exchange_rate_currency_code: string
  total: number
}

export type VariableFee = {
  currency_code: string
  commision: number
  total: number
}

export type FeeDetails = {
  fixed_fee: FixedFee
  variable_fee: VariableFee
}

export type Operation = {
  type: string
  id: string
  creation_date: number
  amount: number
  operation_id: number
}

export type CardMetadata = {
  cardHolderName: string
  billingAddress1: string
  billingAddress2: string
  billingCity: string
  billingState: string
  billingCountry: string
  billingPostalCode?: string
}

export type Card = {
  object: string
  id: string
  active: boolean
  creation_date: number
  customer_id: string
  source: Source
  metadata: CardMetadata
}

export type CardsListRequest = ListRequest & {
  creation_date?: number
  creation_date_from?: number
  creation_date_to?: number
  card_brand?: string
  card_type?: string
  device_type?: string
  bin?: number
  country_code?: string
}

export type CardsListResponse = ListResponse & {
  data: Card[]
}

export type CardCreatePayload = {
  customer_id: string
  token_id: string
  validate?: boolean
  metadata?: CardMetadata
}

export type CardUpdatePayload = {
  token_id?: string
  metadata?: CardMetadata
}

export type Charge = {
  duplicated?: boolean
  object: string
  id: string
  creation_date: number
  amount: number
  amount_refunded: number
  current_amount: number
  installments: number
  installments_amount?: number
  currency_code: string
  email: string
  description: string
  source: Source
  outcome: Outcome
  fraud_score?: number
  antifraud_details: AntifraudDetails
  dispute: boolean
  capture?: boolean
  reference_code: string
  authorization_code: string
  metadata: Record<string, any>
  total_fee?: number
  fee_details: FeeDetails
  total_fee_taxes?: number
  transfer_amount?: number
  paid: boolean
  statement_descriptor: string
  transfer_id: string
  operations: Operation[]
  capture_date?: number
}

export type ChargesListRequest = ListRequest & {
  amount?: number
  min_amount?: number
  max_amount?: number
  installments?: number
  min_installments?: number
  max_installments?: number
  currency_code?: string
  code?: string
  decline_code?: string
  fraud_score?: number
  min_fraud_score?: number
  max_fraud_score?: number
  first_name?: string
  last_name?: string
  email?: string
  address?: string
  address_city?: string
  country_code?: string
  phone_number?: string
  dispute?: boolean
  captured?: boolean
  duplicated?: boolean
  paid?: boolean
  customer_id?: string
  reference?: string
  creation_date?: number
  creation_date_from?: number
  creation_date_to?: number
  fee?: number
  min_fee?: number
  max_fee?: number
  card_brand?: string
  card_type?: string
  device_type?: string
  bin?: number
}

export type ChargesListResponse = ListResponse & {
  data: Charge[]
}

export type ChargeCreatePayload = {
  amount: number
  currency_code: string
  email: string
  source_id: string
  capture?: boolean
  description: string
  installments?: number
  metadata: Record<string, any>
  antifraud_details: AntifraudDetails
}

export type ChargeUpdatePayload = {
  metadata: Record<string, any>
}

export type ClientDetails = {
  first_name: string
  last_name: string
  email: string
  phone_number: string
}

export type Order = {
  object: string
  id: string
  amount: number
  payment_code: string
  currency_code: string
  description: string
  order_number: string
  state: string
  total_fee?: number
  net_amount?: number
  fee_details: FeeDetails
  creation_date: number
  expiration_date: number
  updated_at?: number
  paid_at?: number
  available_on?: number
  metadata: Record<string, any>
}

export type OrdersListRequest = ListRequest & {
  amount?: number
  min_amount?: number
  max_amount?: number
  creation_date?: number
  creation_date_from?: number
  creation_date_to?: number
  state?: string
}

export type OrdersListResponse = ListResponse & {
  data: Order[]
}

export type OrderCreatePayload = {
  amount: number
  currency_code: string
  description: string
  order_number: string
  expiration_date: number
  client_details: ClientDetails
  confirm?: boolean
  metadata: Record<string, any>
}

export type OrderUpdatePayload = {
  expiration_date: number
  metadata?: Record<string, any>
}

export enum RefundReason {
  DUPLICATE = 'duplicado',
  FRAUDULENT = 'fraudulento',
  REQUESTED_BY_CUSTOMER = 'solicitud_comprador',
}

export type Refund = {
  object: string
  id: string
  charge_id: string
  creation_date: number
  amount: number
  reason: string
  metadata: Record<string, any>
}

export type RefundsListRequest = ListRequest & {
  creation_date?: number
  creation_date_from?: number
  creation_date_to?: number
  reason?: RefundReason
}

export type RefundsListResponse = ListResponse & {
  data: Refund[]
}

export type RefundCreatePayload = {
  amount: number
  charge_id: string
  reason: RefundReason
}

export type RefundUpdatePayload = {
  metadata: Record<string, any>
}
