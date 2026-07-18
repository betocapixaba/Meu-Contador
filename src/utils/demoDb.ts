export const isDemoActive = (): boolean => {
  return localStorage.getItem("contador_ia_demo_mode") === "true";
};

// Helper to generate a unique random ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// Add item to a local storage collection
export const localAddDoc = async (collectionName: string, data: any): Promise<{ id: string }> => {
  const key = `demo_${collectionName}`;
  const localData = localStorage.getItem(key);
  const items = localData ? JSON.parse(localData) : [];
  const newItem = {
    id: generateId(),
    ...data
  };
  items.unshift(newItem); // Add to the beginning
  localStorage.setItem(key, JSON.stringify(items));
  return { id: newItem.id };
};

// Update item in local storage collection
export const localUpdateDoc = async (collectionName: string, id: string, updatedFields: any): Promise<void> => {
  const key = `demo_${collectionName}`;
  const localData = localStorage.getItem(key);
  if (!localData) return;
  const items = JSON.parse(localData) as any[];
  const index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    items[index] = { ...items[index], ...updatedFields };
    localStorage.setItem(key, JSON.stringify(items));
  }
};

// Delete item from local storage collection
export const localDeleteDoc = async (collectionName: string, id: string): Promise<void> => {
  const key = `demo_${collectionName}`;
  const localData = localStorage.getItem(key);
  if (!localData) return;
  const items = JSON.parse(localData) as any[];
  const filtered = items.filter(item => item.id !== id);
  localStorage.setItem(key, JSON.stringify(filtered));
};

// Seed initial demo data so the app isn't empty when they first click "Entrar sem Login"
export const seedInitialDemoData = () => {
  const transactionsKey = "demo_transactions";
  const goalsKey = "demo_goals";
  const recurrentKey = "demo_recurrentExpenses";
  const servicesKey = "demo_services";
  const clientsKey = "demo_clients";

  if (!localStorage.getItem(transactionsKey)) {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];

    const initialTransactions = [
      {
        id: "tx-1",
        userId: "local-demo-user",
        type: "receita",
        amount: 4500.00,
        category: "Salário",
        description: "Salário Mensal Principal",
        date: today,
        isRecurrent: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "tx-2",
        userId: "local-demo-user",
        type: "despesa",
        amount: 120.50,
        category: "Alimentação",
        description: "Supermercado Semanal",
        date: yesterday,
        isRecurrent: false,
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: "tx-3",
        userId: "local-demo-user",
        type: "receita",
        amount: 800.00,
        category: "Serviços",
        description: "Freelance de Site Institucional",
        date: yesterday,
        isRecurrent: false,
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: "tx-4",
        userId: "local-demo-user",
        type: "despesa",
        amount: 45.90,
        category: "Transporte",
        description: "Combustível Posto Ipiranga",
        date: threeDaysAgo,
        isRecurrent: false,
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
      },
      {
        id: "tx-5",
        userId: "local-demo-user",
        type: "despesa",
        amount: 250.00,
        category: "Lazer",
        description: "Jantar Especial de Fim de Semana",
        date: threeDaysAgo,
        isRecurrent: false,
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
      }
    ];
    localStorage.setItem(transactionsKey, JSON.stringify(initialTransactions));
  }

  if (!localStorage.getItem(goalsKey)) {
    const initialGoals = [
      {
        id: "goal-1",
        userId: "local-demo-user",
        title: "Reserva de Emergência",
        targetAmount: 5000,
        currentAmount: 2500,
        deadline: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0]
      },
      {
        id: "goal-2",
        userId: "local-demo-user",
        title: "Viagem de Férias",
        targetAmount: 8000,
        currentAmount: 1200,
        deadline: new Date(Date.now() + 180 * 86400000).toISOString().split("T")[0]
      }
    ];
    localStorage.setItem(goalsKey, JSON.stringify(initialGoals));
  }

  if (!localStorage.getItem(recurrentKey)) {
    const initialRecurrent = [
      {
        id: "rec-1",
        userId: "local-demo-user",
        title: "Assinatura Netflix",
        amount: 55.90,
        category: "Lazer",
        dueDate: 10
      },
      {
        id: "rec-2",
        userId: "local-demo-user",
        title: "Internet Banda Larga",
        amount: 149.90,
        category: "Moradia",
        dueDate: 15
      },
      {
        id: "rec-3",
        userId: "local-demo-user",
        title: "Plano de Saúde",
        amount: 450.00,
        category: "Saúde",
        dueDate: 5
      }
    ];
    localStorage.setItem(recurrentKey, JSON.stringify(initialRecurrent));
  }

  if (!localStorage.getItem(servicesKey)) {
    const initialServices = [
      {
        id: "serv-1",
        userId: "local-demo-user",
        title: "Consultoria Financeira",
        amount: 1500.00,
        clientName: "João Silva",
        status: "pago",
        date: new Date().toISOString().split("T")[0]
      },
      {
        id: "serv-2",
        userId: "local-demo-user",
        title: "Criação de Logotipo",
        amount: 600.00,
        clientName: "Maria Souza",
        status: "realizado",
        date: new Date().toISOString().split("T")[0]
      }
    ];
    localStorage.setItem(servicesKey, JSON.stringify(initialServices));
  }

  if (!localStorage.getItem(clientsKey)) {
    const initialClients = [
      {
        id: "cli-1",
        userId: "local-demo-user",
        name: "João Silva",
        email: "joao@example.com",
        phone: "(11) 99999-8888"
      },
      {
        id: "cli-2",
        userId: "local-demo-user",
        name: "Maria Souza",
        email: "maria@example.com",
        phone: "(21) 98888-7777"
      }
    ];
    localStorage.setItem(clientsKey, JSON.stringify(initialClients));
  }
};
