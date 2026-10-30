export type RawSms = {
  id: string;
  /** Sender address, e.g. "VM-HDFCBK". */
  address: string;
  body: string;
  /** Received time, epoch ms. */
  date: number;
};
