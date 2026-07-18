export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    console.warn("Este navegador não suporta notificações.");
    return "denied";
  }
  
  const permission = await Notification.requestPermission();
  return permission;
}

export function getNotificationPermissionState(): NotificationPermission {
  if (!("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

export async function sendSmartNotification(title: string, options?: NotificationOptions) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg) {
        // Send to service worker to handle the notification in the background
        reg.active?.postMessage({
          type: "SHOW_NOTIFICATION",
          title,
          options: {
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            vibrate: [100, 50, 100],
            ...options
          }
        });
      } else {
        // Fallback to standard client-side Notification
        new Notification(title, options);
      }
    } catch (e) {
      console.error("Erro ao enviar notificação via Service Worker:", e);
      new Notification(title, options);
    }
  } else {
    new Notification(title, options);
  }
}

/**
 * Runs smart checks on recurrent bills and savings goals
 */
export function checkSmartAlerts(
  recurrentExpenses: any[],
  goals: any[]
) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const today = new Date();
  const currentDay = today.getDate();
  const currentMonthYear = `${today.getMonth() + 1}_${today.getFullYear()}`;

  // 1. Check Recurrent Expenses (Bills to pay)
  const notifiedBillsKey = `notified_bills_${currentMonthYear}`;
  let notifiedBills: string[] = [];
  try {
    notifiedBills = JSON.parse(localStorage.getItem(notifiedBillsKey) || "[]");
  } catch (e) {
    notifiedBills = [];
  }

  recurrentExpenses.forEach((bill) => {
    if (!bill.id || !bill.dueDate || !bill.title) return;

    // Calculate days until due date
    let daysUntil = 0;
    const dueDate = Number(bill.dueDate);
    if (dueDate >= currentDay) {
      daysUntil = dueDate - currentDay;
    } else {
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      daysUntil = (lastDayOfMonth - currentDay) + dueDate;
    }

    // Alert if bill is due in <= 3 days, and not already notified this month
    if (daysUntil <= 3 && daysUntil >= 0 && !notifiedBills.includes(bill.id)) {
      let msg = "";
      if (daysUntil === 0) {
        msg = `Vence HOJE! Não se esqueça de pagar a conta de $${bill.amount}.`;
      } else if (daysUntil === 1) {
        msg = `Vence AMANHÃ! Gasto recorrente de $${bill.amount} cadastrado.`;
      } else {
        msg = `Vence em ${daysUntil} dias (Dia ${bill.dueDate}). Valor: $${bill.amount}.`;
      }

      sendSmartNotification(`Alerta de Conta: ${bill.title}`, {
        body: msg,
        tag: `bill-${bill.id}-${currentMonthYear}`,
        requireInteraction: true
      });

      notifiedBills.push(bill.id);
      localStorage.setItem(notifiedBillsKey, JSON.stringify(notifiedBills));
    }
  });

  // 2. Check Financial Goals Achieved
  const notifiedGoalsKey = "notified_goals_completed";
  let notifiedGoals: string[] = [];
  try {
    notifiedGoals = JSON.parse(localStorage.getItem(notifiedGoalsKey) || "[]");
  } catch (e) {
    notifiedGoals = [];
  }

  goals.forEach((goal) => {
    if (!goal.id || !goal.title || !goal.targetAmount) return;

    const current = Number(goal.currentAmount || 0);
    const target = Number(goal.targetAmount);

    if (current >= target && !notifiedGoals.includes(goal.id)) {
      sendSmartNotification(`Parabéns! Meta Atingida! 🎉`, {
        body: `Você alcançou a meta "${goal.title}" poupando $${current.toLocaleString()} de $${target.toLocaleString()}!`,
        tag: `goal-${goal.id}`,
        requireInteraction: true
      });

      notifiedGoals.push(goal.id);
      localStorage.setItem(notifiedGoalsKey, JSON.stringify(notifiedGoals));
    }
  });
}
