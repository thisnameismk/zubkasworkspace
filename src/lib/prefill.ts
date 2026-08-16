export interface InvoicePrefill {
  clientId?: string;
  projectId?: string;
  projectName?: string;
  budget?: number;
  description?: string;
}

let current: InvoicePrefill | null = null;

export function setInvoicePrefill(p: InvoicePrefill) {
  current = p;
}

export function consumeInvoicePrefill(): InvoicePrefill | null {
  const v = current;
  current = null;
  return v;
}

let previewInvoiceId: string | null = null;

export function setInvoicePreview(id: string) {
  previewInvoiceId = id;
}

export function consumeInvoicePreview(): string | null {
  const v = previewInvoiceId;
  previewInvoiceId = null;
  return v;
}
