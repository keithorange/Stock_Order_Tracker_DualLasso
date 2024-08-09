import React from 'react';
import { X } from 'lucide-react';

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

const NotificationModal = ({ notifications, orders, onClose, onAction, settings }) => {
  const modalStyle = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    overflowY: 'auto',
  };

  const contentStyle = {
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    maxWidth: '56rem',
    width: '100%',
    margin: '1rem',
    padding: '1.5rem',
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  };

  const titleStyle = {
    fontSize: '1.875rem',
    fontWeight: 800,
    color: '#111827',
  };

  const notificationsContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxHeight: '60vh',
    overflowY: 'auto',
  };

  const notificationStyle = {
    padding: '1rem',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  };

  const notificationHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  };

  const symbolStyle = {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: 'white',
  };

  const profitStyle = (profit) => ({
    fontSize: '1.125rem',
    fontWeight: 600,
    color: profit >= 0 ? 'rgb(134, 239, 172)' : 'rgb(252, 165, 165)',
  });

  const messageStyle = {
    color: 'white',
    marginBottom: '0.5rem',
  };

  const infoGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: 'white',
  };

  const buttonContainerStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    marginTop: '0.5rem',
  };

  const buttonStyle = (bgColor, hoverBgColor) => ({
    padding: '0.25rem 0.75rem',
    backgroundColor: bgColor,
    color: 'white',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    border: 'none',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: hoverBgColor,
    },
  });

  return (
    <div style={modalStyle}>
      <div style={contentStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Trade Alerts</h2>
          {notifications.length > 1 && (
            <button
              onClick={() => onAction(null, 'exitAll')}
              style={{
                ...buttonStyle('#ef4444', '#dc2626'),
                padding: '0.5rem 1rem',
                fontWeight: 'bold',
              }}
            >
              Exit All
            </button>
          )}
        </div>
        <div style={notificationsContainerStyle}>
          {notifications.map((notification, index) => {
            const order = orders.find(o => o.symbol === notification.symbol);
            return (
              <div
                key={index}
                style={{
                  ...notificationStyle,
                  backgroundColor: getBackgroundColor(order?.profit, settings.colorIntensity),
                }}
              >
                <div style={notificationHeaderStyle}>
                  <h3 style={symbolStyle}>{notification.symbol}</h3>
                  <p style={profitStyle(order?.profit)}>
                    {order?.profit >= 0 ? '↗' : '↘'} {order?.profit.toFixed(2)}%
                  </p>
                </div>
                <p style={messageStyle}>{notification.message}</p>
                <div style={infoGridStyle}>
                  <p>Current: ${order?.currentPrice.toFixed(2)}</p>
                  <p>Entry: ${order?.entryPrice.toFixed(2)}</p>
                  <p>Exit: {order?.maType.toUpperCase()} ({order?.period})</p>
                  <p>Initial SL: {order?.initialSL} ({order?.initialSLPct}%)</p>
                  <p>Take Profit: {order?.takeProfitPct}%</p>
                  <p>Secondary SL: {order?.secondarySLPct}%</p>
                </div>
                <div style={buttonContainerStyle}>
                  <button
                    onClick={() => onAction(notification.symbol, 'edit')}
                    style={buttonStyle('#eab308', '#ca8a04')}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onAction(notification.symbol, 'exit')}
                    style={buttonStyle('#ef4444', '#dc2626')}
                  >
                    Exit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
// import React from 'react';
// import { X } from 'lucide-react';

// import "./styles.css";


// const NotificationModal = ({ notifications, orders, onClose, onAction, settings }) => {
//   const getBackgroundColor = (profit, colorIntensity) => {
//     const scaledProfit = profit / colorIntensity;
//     if (scaledProfit >= 0) {
//       const greenIntensity = Math.min(255, Math.floor(scaledProfit * 255));
//       return `rgba(0, ${greenIntensity}, 0, 0.7)`;
//     } else {
//       const redIntensity = Math.min(255, Math.floor(Math.abs(scaledProfit) * 255));
//       return `rgba(${redIntensity}, 0, 0, 0.9)`;
//     }
//   };

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
//       <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full m-4 p-6">
//         <div className="flex justify-between items-center mb-4">
//           <h2 className="text-3xl font-extrabold text-gray-900">Trade Alerts</h2>
//           {notifications.length > 1 && (
//           <div className="mt-4 flex justify-center">
//             <button
//               onClick={() => onAction(null, 'exitAll')}
//               className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-bold"
//             >
//               Exit All
//             </button>
//           </div>
//         )}
//         </div>
//         <div className="space-y-4 max-h-[60vh] overflow-y-auto">
//           {notifications.map((notification, index) => {
//             const order = orders.find(o => o.symbol === notification.symbol);
//             return (
//               <div
//                 key={index}
//                 className="p-4 rounded-lg shadow"
//                 style={{
//                   backgroundColor: getBackgroundColor(order?.profit, settings.colorIntensity),
//                 }}
//               >
//                 <div className="flex justify-between items-center mb-2">
//                   <h3 className="text-xl font-bold text-white">{notification.symbol}</h3>
//                   <p className={`text-lg font-semibold ${order?.profit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
//                     {order?.profit >= 0 ? '↗' : '↘'} {order?.profit.toFixed(2)}%
//                   </p>
//                 </div>
//                 <p className="text-white mb-2">{notification.message}</p>
//                 <div className="grid grid-cols-2 gap-2 text-sm text-white">
//                   <p>Current: ${order?.currentPrice.toFixed(2)}</p>
//                   <p>Entry: ${order?.entryPrice.toFixed(2)}</p>
//                   <p>Exit: {order?.maType.toUpperCase()} ({order?.period})</p>
//                   <p>Initial SL: {order?.initialSL} ({order?.initialSLPct}%)</p>
//                   <p>Take Profit: {order?.takeProfitPct}%</p>
//                   <p>Secondary SL: {order?.secondarySLPct}%</p>
//                 </div>
//                 <div className="flex justify-end space-x-2 mt-2">
//                   <button
//                     onClick={() => onAction(notification.symbol, 'edit')}
//                     className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
//                   >
//                     Edit
//                   </button>
//                   <button
//                     onClick={() => onAction(notification.symbol, 'exit')}
//                     className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
//                   >
//                     Exit
//                   </button>
//                 </div>
//               </div>
//             );
//           })}
//         </div>
        
//       </div>
//     </div>
//   );
// };

// export default NotificationModal;