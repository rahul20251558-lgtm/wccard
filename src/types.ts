export type Category =
  | "Doctor"
  | "Hospital"
  | "Pharmacy"
  | "Distributor"
  | "Retailer"
  | "Supplier"
  | "Vendor"
  | "Manufacturer"
  | "Corporate"
  | "Export Customer"
  | "Import Customer"
  | "Government"
  | "Other";

export type LeadStatus =
  | "New"
  | "Contacted"
  | "Follow-up"
  | "Qualified"
  | "Proposal Sent"
  | "Converted"
  | "Closed";

export type Priority = "High" | "Medium" | "Low";

export interface ContactHistoryItem {
  at: string;
  by: string;
  note: string;
}

export interface ContactRecord {
  recordId: string;
  scanDate: string;
  addedBy: string;
  assignedTo: string;
  category: Category;
  leadStatus: LeadStatus;
  priority: Priority;
  followUpDate: string;
  remarks: string;
  history: ContactHistoryItem[];
  
  // Personal
  name: string;
  designation: string;
  department: string;
  
  // Company
  company: string;
  businessType: string;
  gst: string;
  
  // Contact
  mobile: string;
  whatsapp: string;
  altPhone: string;
  email: string;
  website: string;
  
  // Address
  address: string;
  city: string;
  state: string;
  country: string;
  pin: string;
  
  // Social
  linkedin: string;
  facebook: string;
  instagram: string;
  twitter: string;
  
  // Additional
  qrData: string;
  notes: string;
}

export interface ActivityLog {
  at: string;
  by: string;
  msg: string;
}

export interface QueueItem {
  id: string;
  fileName: string;
  dataUrl: string;
  status: "processing" | "ready" | "error";
  fields: Partial<ContactRecord> | null;
  error?: string;
  suggestions?: string;
}

export const CATEGORIES: Category[] = [
  "Doctor",
  "Hospital",
  "Pharmacy",
  "Distributor",
  "Retailer",
  "Supplier",
  "Vendor",
  "Manufacturer",
  "Corporate",
  "Export Customer",
  "Import Customer",
  "Government",
  "Other"
];

export const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Follow-up",
  "Qualified",
  "Proposal Sent",
  "Converted",
  "Closed"
];

export const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  "New": "#2f80d6",
  "Contacted": "#7a5af8",
  "Follow-up": "#e8a13a",
  "Qualified": "#12a5a5",
  "Proposal Sent": "#d66ba0",
  "Converted": "#2fa262",
  "Closed": "#8a94a6"
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  "High": "#d64545",
  "Medium": "#e8a13a",
  "Low": "#2fa262"
};

export interface FieldGroup {
  title: string;
  fields: [keyof ContactRecord, string][];
}

export const FIELD_GROUPS: FieldGroup[] = [
  {
    title: "Personal",
    fields: [
      ["name", "Full name"],
      ["designation", "Designation"],
      ["department", "Department"]
    ]
  },
  {
    title: "Company",
    fields: [
      ["company", "Company name"],
      ["businessType", "Business type"],
      ["gst", "GST number"]
    ]
  },
  {
    title: "Contact",
    fields: [
      ["mobile", "Mobile"],
      ["whatsapp", "WhatsApp"],
      ["altPhone", "Alternate number"],
      ["email", "Email"],
      ["website", "Website"]
    ]
  },
  {
    title: "Address",
    fields: [
      ["address", "Address line"],
      ["city", "City"],
      ["state", "State"],
      ["country", "Country"],
      ["pin", "PIN code"]
    ]
  },
  {
    title: "Social",
    fields: [
      ["linkedin", "LinkedIn"],
      ["facebook", "Facebook"],
      ["instagram", "Instagram"],
      ["twitter", "Twitter / X"]
    ]
  },
  {
    title: "Additional",
    fields: [
      ["qrData", "QR code data"],
      ["notes", "Notes"]
    ]
  }
];

export const EXPORT_HEADERS: [keyof ContactRecord, string][] = [
  ["recordId", "Record ID"],
  ["scanDate", "Scan Date & Time"],
  ["name", "Name"],
  ["company", "Company"],
  ["designation", "Designation"],
  ["department", "Department"],
  ["mobile", "Mobile"],
  ["whatsapp", "WhatsApp"],
  ["altPhone", "Alternate Mobile"],
  ["email", "Email"],
  ["website", "Website"],
  ["address", "Address"],
  ["city", "City"],
  ["state", "State"],
  ["country", "Country"],
  ["pin", "PIN"],
  ["gst", "GST Number"],
  ["businessType", "Business Type"],
  ["category", "Category"],
  ["leadStatus", "Lead Status"],
  ["priority", "Priority"],
  ["assignedTo", "Assigned Employee"],
  ["followUpDate", "Next Follow-up"],
  ["remarks", "Remarks"],
  ["linkedin", "LinkedIn"],
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["twitter", "Twitter"],
  ["qrData", "QR Data"],
  ["notes", "Notes"],
  ["addedBy", "Added By"]
];
