import { create } from 'zustand';

interface TransactionState {
  transactions: any[];
  filters: {
    dateRange: { from: Date | null; to: Date | null };
    vendor: string;
    amount: { min: number; max: number };
    status: string;
  };
  setTransactions: (transactions: any[]) => void;
  setFilters: (filters: Partial<TransactionState['filters']>) => void;
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  filters: {
    dateRange: { from: null, to: null },
    vendor: '',
    amount: { min: 0, max: Infinity },
    status: '',
  },
  setTransactions: (transactions) => set({ transactions }),
  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),
}));
