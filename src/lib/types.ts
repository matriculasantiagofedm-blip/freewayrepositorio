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

export interface Contract {
  id: string;
  title: string;
  client: Client;
  content: string;
  deadlines: Deadline[];
  status: 'draft' | 'active' | 'completed' | 'expired';
}
