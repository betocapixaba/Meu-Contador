export interface Transaction {
  id: string;
  userId: string;
  type: "receita" | "despesa";
  amount: number;
  category: string;
  location: string | null;
  client: string | null;
  description: string;
  date: string; // YYYY-MM-DD
  isRecurrent: boolean;
  receiptImage: string | null; // base64 or photo string
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // YYYY-MM-DD
}

export interface RecurrentExpense {
  id: string;
  userId: string;
  title: string;
  amount: number;
  category: string;
  dueDate: number; // Day of the month
}

export interface Service {
  id: string;
  userId: string;
  title: string;
  amount: number;
  clientName: string;
  status: "pendente" | "realizado" | "pago";
  date: string; // YYYY-MM-DD
}

export interface Client {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
}
