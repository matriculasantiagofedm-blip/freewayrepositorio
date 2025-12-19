export interface Deadline {
  id: string;
  description: string;
  date: Date;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export type ContractStatus = 'draft' | 'active' | 'completed' | 'expired';
export type ContractType = 'Curso Auto' | 'Curso Moto';

export interface Contract {
  id: string;
  title: string;
  client: Client;
  content: string;
  deadlines: Deadline[];
  status: ContractStatus;
  type: ContractType;
}
