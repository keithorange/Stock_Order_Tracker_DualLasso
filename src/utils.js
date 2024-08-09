export const getBackgroundColor = (profit) => {
  if (profit >= 0) {
    const greenIntensity = Math.min(255, Math.floor((profit / 10) * 255));
    return `rgba(0, ${greenIntensity}, 0, 0.7)`;
  } else {
    const redIntensity = Math.min(255, Math.floor((Math.abs(profit) / 5) * 255));
    return `rgba(${redIntensity}, 0, 0, 0.9)`;
  }
};

export const fetchOrders = async (setOrders, setCompletedOrders) => {
  try {
    const response = await fetch("http://localhost:5000/api/orders");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      setOrders(data.filter((order) => order.status !== "EXITED"));
      setCompletedOrders(data.filter((order) => order.status === "EXITED"));
    } else {
      console.error("Failed to fetch orders: Response is not an array");
    }
  } catch (error) {
    console.error("Failed to fetch orders:", error);
  }
};

export const fetchNotifications = async (setNotifications, settings, playNotificationSound, setShowNotificationModal, setCurrentNotification) => {
  try {
    const response = await fetch("http://localhost:5000/api/notifications");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    setNotifications(data);
    if (data.length > 0 && settings.sound) {
      playNotificationSound();
      setShowNotificationModal(true);
      setCurrentNotification(data[0]);
    }
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
  }
};

export const createTestOrder = async (fetchOrders, setOrders, setCompletedOrders) => {
  try {
    const response = await fetch("http://localhost:5000/api/test-order", {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    await fetchOrders(setOrders, setCompletedOrders);
  } catch (error) {
    console.error("Failed to create test order:", error);
  }
};

export const handleExitTrade = async (symbol, setOrders, setShowConfetti, playSuccessSound, setShowEmoji, playFailureSound) => {
  try {
    const response = await fetch(`http://localhost:5000/api/orders/${symbol}/exit`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const updatedOrder = await response.json();
    setOrders(prevOrders => prevOrders.map(order => order.symbol === symbol ? updatedOrder : order));
    if (updatedOrder.profit > 0) {
      setShowConfetti(true);
      playSuccessSound();
      setTimeout(() => setShowConfetti(false), 5000);
    } else {
      setShowEmoji(true);
      playFailureSound();
      setTimeout(() => setShowEmoji(false), 3000);
    }
  } catch (error) {
    console.error("Failed to exit trade:", error);
  }
};
