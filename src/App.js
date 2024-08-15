import React, { useState, useEffect, useCallback, useRef } from "react";
import { Rocket, Settings, Bell, ChevronRight, X, Edit } from "lucide-react";

import "./styles.css";
import Confetti from "react-confetti";
import Chart from "react-apexcharts";
import Modal from "react-modal";
import GraphsTab from "./GraphsTab"; // Adjust the import path as necessary
import NotificationModal from './NotificationModal';

Modal.setAppElement("#root");

const getBackgroundColor = (profit, colorIntensity) => {
  const scaledProfit = profit / colorIntensity;
  if (scaledProfit >= 0) {
    const greenIntensity = Math.min(255, Math.floor(scaledProfit * 255));
    return `rgba(0, ${greenIntensity}, 0, 0.7)`;
  } else {
    const redIntensity = Math.min(255, Math.floor(Math.abs(scaledProfit) * 255));
    return `rgba(${redIntensity}, 0, 0, 0.9)`;
  }
};


const StockOrderTracker = () => {
  const [activeTab, setActiveTab] = useState("newOrder");
  const [selectedStock, setSelectedStock] = useState("");
  const [orderType, setOrderType] = useState("market");
  const [entryPrice, setEntryPrice] = useState("");
  const [maType, setMAType] = useState("EMA");
  const [period, setPeriod] = useState("");
  const [initialSL, setInitialSL] = useState("trailing");
  const [initialSLPct, setInitialSLPct] = useState(null);
  const [isSecondarySLChecked, setIsSecondarySLChecked] = useState(false);
  const [secondarySLPct, setSecondarySLPct] = useState(null);
  const [takeProfitPct, setTakeProfitPct]= useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({ telegram: true, sound: true, colorIntensity: 2.0 });
  const [editingOrder, setEditingOrder] = useState(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [candleData, setCandleData] = useState([]);
  // const [showNotificationModal, setShowNotificationModal] = useState(false);
  // const [currentNotification, setCurrentNotification] = useState(null);
  // const [notifications, setNotifications] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const [chartOptions, setChartOptions] = useState({
    chart: {
      type: 'candlestick',
      height: '100%',
      animations: {
        enabled: false
      }
    },
    xaxis: {
      type: 'numeric',
      tickAmount: 10,
      labels: {
        formatter: function(value, timestamp, opts) {
          if (opts && opts.w && opts.w.globals && opts.w.globals.initialSeries && opts.w.globals.initialSeries[0]) {
            const dataPoint = opts.w.globals.initialSeries[0].data[Math.floor(value)];
            if (dataPoint) {
              const date = new Date(dataPoint.x);
              return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric'
              });
            }
          }
          return '';
        }
      }
    },      
    yaxis: {
      tooltip: {
        enabled: true
      },
      labels: {
        formatter: (value) => `$${value.toFixed(2)}`
      }
    },
    tooltip: {
      enabled: true,
      theme: 'dark',
      x: {
        formatter: function(value) {
          const dataPoint = chartSeries[0]?.data[Math.floor(value)];
          if (dataPoint) {
            const date = new Date(dataPoint.x);
            return date.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric'
            });
          }
          return '';
        }
      },
      y: {
        formatter: undefined,
        title: {
          formatter: (seriesName) => seriesName,
        },
      },
    },
  });
  const [chartSeries, setChartSeries] = useState([]);
  const [showChartModal, setShowChartModal] = useState(false);

  
  const handleOrderClick = async (orderId) => {
    const order = orders.find((o) => o.symbol === orderId);
    setSelectedOrderId(orderId === selectedOrderId ? null : orderId);
    if (order) {
      await fetchCandleData(order);
    }
  };

  const openChartModal = async (orderId) => {
    const order = orders.find((o) => o.symbol === orderId);
    if (order) {
      await fetchCandleData(order);
      setShowChartModal(true);
    }
  };

  // Function to close chart modal
  const closeChartModal = () => {
    setShowChartModal(false);
  };

  const notificationSoundRef = useRef(null);
  const winSoundRef = useRef(null);
  const lossSoundRef = useRef(null);


  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchOrders()
    }, 25 * 1000); // Fetch EVERY FEW S
    return () => clearInterval(interval);
  }, []);

    // Updated: Filter orders based on status
    const activeOrders = orders.filter(order => order.status !== "EXITED");
    const completedOrders = orders.filter(order => order.status === "EXITED");

  const fetchOrders = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/orders");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        // Sort active orders by entryDatetime (newest first)
        const sortedActiveOrders = data
          .filter(order => order.status !== "EXITED")
          .sort((a, b) => new Date(b.entryDatetime) - new Date(a.entryDatetime));
        
        // Sort completed orders by exitDatetime (newest first)
        const sortedCompletedOrders = data
          .filter(order => order.status === "EXITED")
          .sort((a, b) => new Date(b.exitDatetime) - new Date(a.exitDatetime));
        
        setOrders([...sortedActiveOrders, ...sortedCompletedOrders]);
      } else {
        console.error("Failed to fetch orders: Response is not an array");
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    }
  };


  useEffect(() => {
    if (activeTab === "graphs" || activeTab === "completedOrders") {
      fetchOrders();
    }
  }, [activeTab]);

  const fetchNotifications = async () => {
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
      } else {
        stopNotificationSound();
        setShowNotificationModal(false);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };
  const handleExitAllTrades = async () => {
    for (const notification of notifications) {
      await handleExitTrade(notification.symbol);
    }
    setShowNotificationModal(false);
  };
// ... [Previous NotificationModal component code remains unchanged]

// Add this updated function to your main component file (e.g., StockOrderTracker.js)
const handleExitTrade = async (symbol) => {
  try {
    const response = await fetch(
      `http://localhost:5000/api/orders/${symbol}/exit`,
      {
        method: "POST",
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Remove the exited trade from the notifications list
    setNotifications(prevNotifications => 
      prevNotifications.filter(notification => notification.symbol !== symbol)
    );

    // // Fetch updated orders and notifications
    await fetchOrders();
    //await fetchNotifications();

    const order = orders.find((o) => o.symbol === symbol);
    if (order && order.profit > 0) {
      playSuccessSound();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    } else {
      playFailureSound();
      setShowEmoji(true);
      setTimeout(() => setShowEmoji(false), 3000);
    }
  } catch (error) {
    console.error("Failed to exit trade:", error);
  }
};

// Function to delete a single order by symbol
const handleDeleteOrder = async (symbol) => {
  try {
    // Delete the order with the given symbol
    const response = await fetch(`http://localhost:5000/api/orders/${symbol}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete the order with symbol: ${symbol}`);
    }

    // Fetch updated orders after deletion
    await fetchOrders();
  } catch (error) {
    console.error("Failed to delete the order:", error);
  }
};

// Function to delete all completed orders
const handleDeleteAllCompletedOrders = async () => {
  try {
    // Delete all completed orders
    const response = await fetch(`http://localhost:5000/api/orders/completed`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error("Failed to delete all completed orders");
    }

    // Fetch updated orders after deletion
    await fetchOrders();
  } catch (error) {
    console.error("Failed to delete all completed orders:", error);
  }
};


const stopNotificationSound = useCallback(() => {
  if (notificationSoundRef.current) {
    notificationSoundRef.current.pause();
    notificationSoundRef.current.currentTime = 0;
  }
}, []);


const handleNotificationAction = async (symbol, action) => {
  stopNotificationSound();

  if (action === "exitAll") {
    await handleExitAllTrades();
  } else if (action === "exit") {
    await handleExitTrade(symbol);
  } else if (action === "edit") {
    const orderToEdit = orders.find((o) => o.symbol === symbol);
    if (orderToEdit) {
      handleEditOrder(orderToEdit);
      setShowNotificationModal(false);
    } else {
      console.error(`Order with symbol ${symbol} not found`);
    }
  }

  // Check if we need to close the modal
  if (notifications.length === 0) {
    setShowNotificationModal(false);
  }
};

  const fetchCandleData = async (order) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/stock/${order.symbol}?interval=1m`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const formattedData = data.map((item, index) => ({
        x: index,
        y: [item.Open, item.High, item.Low, item.Close],
        timestamp: new Date(item.Datetime).getTime()
      }));

      const series = [{
        name: order.symbol,
        data: formattedData,
      }];

      const annotations = {
        xaxis: [
          {
            x: formattedData.findIndex(d => d.timestamp >= new Date(order.entryDatetime).getTime()),
            borderColor: '#00E396',
            label: {
              text: 'Entry',
              style: { color: '#fff', background: '#00E396' },
            },
          },
          order.exitDatetime && {
            x: formattedData.findIndex(d => d.timestamp >= new Date(order.exitDatetime).getTime()),
            borderColor: '#FF4560',
            label: {
              text: 'Exit',
              style: { color: '#fff', background: '#FF4560' },
            },
          },
        ].filter(Boolean),
      };

      setChartOptions(prevOptions => ({
        ...prevOptions,
        annotations: annotations,
      }));

      setChartSeries(series);
    } catch (error) {
      console.error('Failed to fetch candle data:', error);
    }
  };

  const handleEditOrder = (order) => {
    setEditingOrder(order);
    setActiveTab("newOrder");
    // variables for order
    setSelectedStock(order.symbol);
    setOrderType(order.orderType); // Provide a default value
    setEntryPrice(order.entryPrice ? order.entryPrice.toString() : "");
    setMAType(order.maType);
    setPeriod(order.period.toString());
    setInitialSL(order.initialSL);
    setInitialSLPct(order.initialSLPct.toString());
    setSecondarySLPct(order.secondarySLPct.toString());
    setTakeProfitPct(order.takeProfitPct.toString());
    setIsEditing(true);
    
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
  
    // Check if entryPrice is not null and is a number.
    let orderEntryPrice = parseFloat(entryPrice);
    if (entryPrice !== null && isNaN(orderEntryPrice)) {
      // alert("Please enter a valid entry price.");
      // return;
      console.log("Entry price is NULL. Either 'MARKET' order, or error.")
      orderEntryPrice = null;
    }
  
    
      
    const orderData = {
      symbol: selectedStock,
      status: isEditing ? editingOrder.status : "HOLDING",
      orderType: orderType,
      entryPrice: orderEntryPrice,
      maType: maType,
      period: parseInt(period),
      initialSL: initialSL,
      initialSLPct: parseFloat(initialSLPct),
      secondarySLPct: isSecondarySLChecked ? parseFloat(secondarySLPct) : 100,
      takeProfitPct: isSecondarySLChecked ? parseFloat(takeProfitPct) : 100,
    };

    try {
      let response;
      if (isEditing) {
        response = await fetch(`http://localhost:5000/api/orders/${editingOrder.symbol}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderData),
        });
      } else {
        response = await fetch("http://localhost:5000/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderData),
        });
      }
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      await fetchOrders();
      setActiveTab("activeOrders");
      setIsEditing(false);
      setEditingOrder(null);
      // Reset form fields
      setSelectedStock("");
      setOrderType("market");
      setEntryPrice("");
      setMAType("EMA");
      setPeriod("");
      setInitialSL("trailing");
      setInitialSLPct("");
      setSecondarySLPct("");
      setTakeProfitPct("");
      setIsSecondarySLChecked(false);
    } catch (error) {
      console.error("Failed to submit order:", error);
      alert("Failed to submit order. Please try again.");
    }
  };

  const playNotificationSound = useCallback(() => {
    if (settings.sound) {
      notificationSoundRef.current.loop = true;
      notificationSoundRef.current
        .play()
        .catch((error) => console.error("Audio play failed:", error));
    }
  }, [settings.sound]);

  const playSuccessSound = () => {
    winSoundRef.current
      .play()
      .catch((error) => console.error("Audio play failed:", error));
  };

  const playFailureSound = () => {
    lossSoundRef.current
      .play()
      .catch((error) => console.error("Audio play failed:", error));
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-white p-8 flex items-center justify-center">
      <audio ref={notificationSoundRef} src="/sounds/notification-sound.wav" />
      <audio ref={winSoundRef} src="/sounds/win-sound.mp3" />
      <audio ref={lossSoundRef} src="/sounds/loss-sound.wav" />
      <div className="bg-white/10 backdrop-blur-lg shadow-xl p-8 rounded-md w-full max-w-2xl">
        <div className="flex flex-row items-center justify-between">
          <h1 className="text-4xl font-bold text-center flex items-center justify-center font-space-grotesk">
          Dual-Lasso 🐎📿
          </h1>
          <div>
            <div className="flex items-center space-x-2">
              {/* <button
                className="p-2 border rounded-full button"
                onClick={createTestOrder}
              >
                Test Order
              </button> */}
              <button
                className="p-2 border rounded-full button"
                onClick={() => setSettingsModalOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
            {settingsModalOpen && (
              <div className="modal open">
                <div className="modal-content">
                  <h2>Settings</h2>
                  <div className="flex items-center justify-between py-2">
                    <span>Telegram Notifications</span>
                    <input
                      type="checkbox"
                      checked={settings.telegram}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          telegram: e.target.checked,
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span>Sound Notifications</span>
                    <input
                      type="checkbox"
                      checked={settings.sound}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          sound: e.target.checked,
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span>Color Intensity</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.1"  // Allows for floating-point values
                      value={settings.colorIntensity}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          colorIntensity: parseFloat(e.target.value),  // Handle as floating-point
                        }))
                      }
                    />
                    <span>{settings.colorIntensity}</span>
                  </div>

                  <button
                    className="button"
                    onClick={() => setSettingsModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="w-full mt-4">
          <div className="flex w-full">
            <button
              onClick={() => setActiveTab("newOrder")}
              className={`w-1/3 p-4 ${activeTab === "newOrder" ? "bg-blue-500" : "bg-gray-500"} transition-all duration-300 button`}
            >
              New Order 🚀
            </button>
            <button
              onClick={() => setActiveTab("activeOrders")}
              className={`w-1/3 p-4 ${activeTab === "activeOrders" ? "bg-blue-500" : "bg-gray-500"} transition-all duration-300 button`}
            >
              Active Orders 📊
            </button>
            <button
              onClick={() => setActiveTab("completedOrders")}
              className={`w-1/3 p-4 ${activeTab === "completedOrders" ? "bg-blue-500" : "bg-gray-500"} transition-all duration-300 button`}
            >
              Completed Orders ✅
            </button>
            <button
              onClick={() => setActiveTab("graphs")}
              className={`w-1/4 p-4 ${activeTab === "graphs" ? "bg-blue-500" : "bg-gray-500"} transition-all duration-300 button`}
            >
              Graphs 📈
            </button>
          </div>
          {activeTab === "newOrder" && (
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <input
                type="text"
                placeholder="Enter stock symbol (e.g., AAPL)"
                value={selectedStock}
                onChange={(e) => setSelectedStock(e.target.value)}
                className="input-field p-4 text-black rounded-md"
              />
              {orderType === "limit" && (
              <input
                type="number"
                placeholder="Entry Price"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="input-field p-4 text-black rounded-md"
                step="any"
                required
              />)}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setOrderType("market");
                    setEntryPrice("");
                  }}
                  className={`flex-1 p-4 button market ${orderType === "market" ? "active" : ""}`}
                >
                  Market
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType("limit")}
                  className={`flex-1 p-4 button limit ${orderType === "limit" ? "active" : ""}`}
                >
                  Limit
                </button>
              </div>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setMAType("EMA")}
                  className={`flex-1 p-4 button EMA ${maType === "EMA" ? "active" : ""}`}
                >
                  EMA
                </button>
                <button
                  type="button"
                  onClick={() => setMAType("HMA")}
                  className={`flex-1 p-4 button HMA ${maType === "HMA" ? "active" : ""}`}
                >
                  HMA
                </button>
              </div>
              <input
                type="number"
                placeholder="Period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="input-field p-4 text-black rounded-md"
                step="any"
              />
              <div className="flex items-center space-x-2">
                <span>Initial Stop Loss:</span>
                <input
                  type="checkbox"
                  checked={initialSL === "trailing"}
                  onChange={(e) =>
                    setInitialSL(e.target.checked ? "trailing" : "static")
                  }
                />
                <span>{initialSL === "trailing" ? "Trailing" : "Static"}</span>
              </div>
              
              <div>
                <input
                  type="number"
                  placeholder="Initial Stop Loss %"
                  title="Initial Stop Loss %"
                  value={initialSLPct}
                  onChange={(e) => setInitialSLPct(e.target.value)}
                  className="input-field p-4 text-black rounded-md"
                  step="any"
                />
              </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isSecondarySLChecked}
                onChange={(e) => {
                  setIsSecondarySLChecked(e.target.checked);
                  if (!e.target.checked) {
                    setTakeProfitPct(100);
                    setSecondarySLPct(100);
                  }
                }}
              />
              <span>Secondary Stop Loss</span>
            

            {isSecondarySLChecked && (
              <div className="flex space-x-4 mt-4">
                <input
                  type="number"
                  placeholder="Take Profit %"
                  title="Take Profit %"
                  value={takeProfitPct}
                  onChange={(e) => setTakeProfitPct(e.target.value)}
                  className="input-field p-4 text-black rounded-md"
                  step="any"
                />
                <input
                  type="number"
                  placeholder="Secondary Stop Loss %"
                  title="Secondary Stop Loss %"
                  value={secondarySLPct}
                  onChange={(e) => setSecondarySLPct(e.target.value)}
                  className="input-field p-4 text-black rounded-md"
                  step="any"
                />
              </div>
            )}
            </div>

              <button
                  type="submit"
                  className={`w-full p-4 ${isEditing ? "bg-yellow-500" : "bg-gradient-to-r from-green-400 to-blue-500"} hover:from-pink-500 hover:to-yellow-500 transition-all duration-300 button`}
                >
                  {isEditing ? "Update Order 🔄" : "Place Order 🚀"}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditingOrder(null);
                      setActiveTab("activeOrders");
                    }}
                    className="w-full p-4 bg-red-500 hover:bg-red-600 transition-all duration-300 button mt-4"
                  >
                    Cancel Edit ❌
                  </button>
                )}

            </form>
          )}
          {activeTab === "activeOrders" && (
            <div className="trade-list">
              {activeOrders.length > 0 ? (
                activeOrders.map((order) => (
                  <div
                    key={order.symbol}
                    className={`trade-item ${selectedOrderId === order.symbol ? "ring-2 ring-blue-500" : ""}`}
                    style={{
                      backgroundColor: getBackgroundColor(order.profit, settings.colorIntensity),
                    }}
                    onClick={() => handleOrderClick(order.symbol)}
                  >
                    <div className="stock">{order.symbol}</div>
                    <div
                      className={`profit ${order.profit >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {order.profit >= 0 ? "↗" : "↘"}{" "}
                      {order.profit.toFixed(2)}%
                    </div>
                    <p>
                      Entry: ${order.entryPrice.toFixed(2)} | Current: $
                      {order.currentPrice.toFixed(2)}
                    </p>
                    <p>
                      Exit: {order.maType.toUpperCase()} ({order.period})
                    </p>
                    <p>
                      Initial SL: {order.initialSL} {order.initialSLPct} | Take Profit: {order.takeProfitPct} | Secondary SL: {order.secondarySL} {order.secondarySLPct} 
                    </p>
                    {selectedOrderId === order.symbol && (
                      <div className="mt-4">
                        <button
                          className="w-full bg-blue-500 hover:bg-blue-600 transition-all duration-300 button"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the parent onClick
                            openChartModal(order.symbol);
                          }}
                        >
                          📊
                        </button>
                        <button
                          className="w-1/3 bg-red-500 hover:bg-red-600 transition-all duration-300 button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExitTrade(order.symbol);
                          }}
                        >
                          🚪
                        </button>

                        <button
                          className="flex-1 bg-yellow-500 hover:bg-yellow-600 transition-all duration-300 button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditOrder(order);
                          }}
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div>No orders available</div>
              )}
            </div>
          )}
          {activeTab === "completedOrders" && (
            <div className="trade-list">
              <button
                style={{
                  backgroundColor: '#f56565', // Red background
                  color: '#fff',              // White text
                  padding: '8px 12px',        // Padding
                  border: 'none',             // No border
                  borderRadius: '4px',        // Slightly rounded corners
                  fontSize: '14px',           // Small text
                  cursor: 'pointer',          // Pointer cursor on hover
                  transition: 'background-color 0.2s', // Smooth color transition
                  marginBottom: '15px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c53030'} // Darker red on hover
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f56565'} // Original red on hover out
                onClick={handleDeleteAllCompletedOrders}
              >
                Delete All Completed Orders
              </button>



              {completedOrders.length > 0 ? (
                completedOrders.map((order) => (
                  <div
                    key={order.symbol}
                    className={`trade-item ${selectedOrderId === order.symbol ? "ring-2 ring-blue-500" : ""}`}
                    style={{
                      backgroundColor: getBackgroundColor(order.profit, settings.colorIntensity),
                    }}
                    onClick={() => handleOrderClick(order.symbol)}
                  >
                    <div className="stock">{order.symbol}</div>
                    <div
                      className={`profit ${order.profit >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {order.profit >= 0 ? "↗" : "↘"}{" "}
                      {order.profit.toFixed(2)}%
                    </div>
                    <p>
                      Entry: ${order.entryPrice.toFixed(2)} | Exit: ${order.currentPrice.toFixed(2)}
                    </p>
                    <p>
                      Exit Strategy: {order.maType.toUpperCase()} (
                      {order.period})
                    </p>
                    <p>
                      Initial SL: {order.initialSL} {order.initialSLPct} | Take Profit: {order.takeProfitPct} | Secondary SL: {order.secondarySL} {order.secondarySLPct} 
                    </p>
                    <p>
                      Exit Reason: {order.exitReason}
                    </p>

                    {selectedOrderId === order.symbol && (
                      <div className="mt-4">
                        <button
                          className="w-full bg-blue-500 hover:bg-blue-600 transition-all duration-300 button"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the parent onClick
                            openChartModal(order.symbol);
                          }}
                        >
                          📊
                        </button>
                        <button
                          className="w-full bg-red-500 hover:bg-red-600 transition-all duration-300 button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOrder(order.symbol);
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div>No completed orders available</div>
              )}
            </div>
          )}



          {activeTab === "graphs" && (
            <GraphsTab completedOrders={completedOrders} />
          )}

          {/* price chart modal */}
            
          {showNotificationModal && notifications.length > 0 && (
            <div style={{position:'absolute', top:'5%', right:'5%'}}>
              <NotificationModal
                notifications={notifications}
                orders={orders}
                onClose={() => setShowNotificationModal(false)}
                onAction={handleNotificationAction}
                settings={settings}
              />
            </div>
          )}

         <Modal
          isOpen={showChartModal}
          onRequestClose={closeChartModal}
          className="modal-content"
          overlayClassName="modal-overlay"
          style={{
            content: {
              width: '90%',
              height: '90%',
              maxWidth: '1200px',
              maxHeight: '800px',
            }
          }}
        >
          <button onClick={closeChartModal} className="close-button">
            <X className="h-6 w-6" />
          </button>
          {selectedOrderId && (
            <div style={{ width: '100%', height: '100%' }}>
              <Chart
                options={chartOptions}
                series={chartSeries}
                type="candlestick"
                height="100%"
              />
            </div>
          )}
        </Modal>


          {showConfetti && <Confetti />}
          {showEmoji && (
            <div className="fixed bottom-8 right-8 text-6xl">😜</div>
          )}
          <div className="mascot">💸</div>
        </div>
      </div>
    </div>
  );
};

export default StockOrderTracker;
