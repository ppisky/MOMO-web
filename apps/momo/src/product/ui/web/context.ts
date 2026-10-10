import { createContext, useContext } from 'react';
import type { Workspace } from './api';
export type ProductContext = {
  data: Workspace;
  path: string;
  navigate: (path: string) => void;
  reload: () => void;
  openSettings: (page?: string) => void;
  selectedRole: string | null;
  selectRole: (id: string | null) => void;
  openSearch: () => void;
  runningConversationId?: string | null;
  setConversationRunning?: (id: string | null) => void;
};
export const Product = createContext<ProductContext | null>(null);
export function useProduct() {
  const value = useContext(Product);
  if (!value) throw Error('Missing product context');
  return value;
}
