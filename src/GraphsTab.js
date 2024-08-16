import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const testCompletedOrders = [
  {
    symbol: "AAPL",
    status: "EXITED",
    entryPrice: 100.0,
    currentPrice: 223.96,
    profit: 123.96,
    entryDatetime: "2024-07-22T20:32:00.458660",
    exitDatetime: "2024-07-22T21:32:00.458660",
    initialSL: "trailing",
  },
  {
    symbol: "GOOGL",
    status: "EXITED",
    entryPrice: 1500.0,
    currentPrice: 1450.0,
    profit: -3.33,
    entryDatetime: "2024-07-22T21:15:30.123456",
    exitDatetime: "2024-07-22T22:15:30.123456",
    initialSL: "fixed",
  },
  // ... (other test orders)
];

const GraphsTab = ({ completedOrders = testCompletedOrders }) => {
  const [fee, setFee] = useState(0);
  const [profitData, setProfitData] = useState([]);
  const [runningProfitData, setRunningProfitData] = useState([]);
  const [distributionData, setDistributionData] = useState([]);
  const [holdingTimeData, setHoldingTimeData] = useState([]);
  const [profitBySymbolData, setProfitBySymbolData] = useState([]);
  const [profitByStopLossType, setProfitByStopLossType] = useState([]);

  useEffect(() => {
    if (completedOrders && completedOrders.length > 0) {
      const sortedOrders = [...completedOrders].sort(
        (a, b) => new Date(a.exitDatetime) - new Date(b.exitDatetime)
      );

      // Process data for LineChart (Profit over time)
      const profitOverTime = sortedOrders.map((order, index) => ({
        trade: index + 1,
        profitWithoutFee: order.profit,
        profitWithFee: order.profit - fee,
        symbol: order.symbol,
      }));
      setProfitData(profitOverTime);

      // Process data for running sum of profit percentage
      let cumulativeProfitWithoutFee = 0;
      let cumulativeProfitWithFee = 0;
      const runningProfitData = sortedOrders.map((order, index) => {
        cumulativeProfitWithoutFee += order.profit;
        cumulativeProfitWithFee += order.profit - fee;
        return {
          trade: index + 1,
          cumulativeProfitWithoutFee: parseFloat(cumulativeProfitWithoutFee.toFixed(2)),
          cumulativeProfitWithFee: parseFloat(cumulativeProfitWithFee.toFixed(2)),
        };
      });
      setRunningProfitData(runningProfitData);

      // Process data for BarChart (Profit distribution)
      const profitRanges = [
        { range: "<-20%", countWithoutFee: 0, countWithFee: 0 },
        { range: "-20% to -10%", countWithoutFee: 0, countWithFee: 0 },
        { range: "-10% to 0%", countWithoutFee: 0, countWithFee: 0 },
        { range: "0% to 10%", countWithoutFee: 0, countWithFee: 0 },
        { range: "10% to 20%", countWithoutFee: 0, countWithFee: 0 },
        { range: ">20%", countWithoutFee: 0, countWithFee: 0 },
      ];

      sortedOrders.forEach((order) => {
        const profitWithoutFee = order.profit;
        const profitWithFee = order.profit - fee;
        
        const updateCount = (profit, countKey) => {
          if (profit < -20) profitRanges[0][countKey]++;
          else if (profit < -10) profitRanges[1][countKey]++;
          else if (profit < 0) profitRanges[2][countKey]++;
          else if (profit < 10) profitRanges[3][countKey]++;
          else if (profit < 20) profitRanges[4][countKey]++;
          else profitRanges[5][countKey]++;
        };

        updateCount(profitWithoutFee, 'countWithoutFee');
        updateCount(profitWithFee, 'countWithFee');
      });
      setDistributionData(profitRanges);

      // Process data for ScatterChart (Holding Time vs Profit)
      const holdingTimeData = sortedOrders.map((order) => {
        const entryTime = new Date(order.entryDatetime);
        const exitTime = new Date(order.exitDatetime);
        const holdingTimeHours = (exitTime - entryTime) / (1000 * 60 * 60);
        return {
          holdingTime: parseFloat(holdingTimeHours.toFixed(2)),
          profitWithoutFee: order.profit,
          profitWithFee: order.profit - fee,
          symbol: order.symbol,
        };
      });
      setHoldingTimeData(holdingTimeData);

      // Process data for BarChart (Profit by Symbol)
      const profitBySymbol = sortedOrders.reduce((acc, order) => {
        if (!acc[order.symbol]) {
          acc[order.symbol] = { withoutFee: 0, withFee: 0 };
        }
        acc[order.symbol].withoutFee += order.profit;
        acc[order.symbol].withFee += order.profit - fee;
        return acc;
      }, {});

      const profitBySymbolData = Object.entries(profitBySymbol).map(([symbol, profit]) => ({
        symbol,
        profitWithoutFee: parseFloat(profit.withoutFee.toFixed(2)),
        profitWithFee: parseFloat(profit.withFee.toFixed(2)),
      }));
      setProfitBySymbolData(profitBySymbolData);

      // Process data for BarChart (Profit by Stop Loss Type)
      const profitByStopLoss = sortedOrders.reduce((acc, order) => {
        const type = order.initialSL === 'trailing' ? 'Trailing' : 'Static';
        if (!acc[type]) {
          acc[type] = { withoutFee: 0, withFee: 0, count: 0 };
        }
        acc[type].withoutFee += order.profit;
        acc[type].withFee += order.profit - fee;
        acc[type].count++;
        return acc;
      }, {});

      const profitByStopLossData = Object.entries(profitByStopLoss).map(([type, data]) => ({
        type,
        profitWithoutFee: parseFloat((data.withoutFee / data.count).toFixed(2)),
        profitWithFee: parseFloat((data.withFee / data.count).toFixed(2)),
      }));
      setProfitByStopLossType(profitByStopLossData);
    }
  }, [completedOrders, fee]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip bg-white p-4 rounded shadow">
          <p className="label">{`Trade: ${label}`}</p>
          <p className="intro">{`Symbol: ${payload[0].payload.symbol}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toFixed(2)}%`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const findMaxCumulativeProfit = () => {
    return Math.max(
      ...runningProfitData.map((d) => Math.max(d.cumulativeProfitWithoutFee, d.cumulativeProfitWithFee))
    );
  };

  const findMinCumulativeProfit = () => {
    return Math.min(
      ...runningProfitData.map((d) => Math.min(d.cumulativeProfitWithoutFee, d.cumulativeProfitWithFee))
    );
  };
  const calculateTotalReturnPercentage = (orders, fee) => {
    if (!orders || orders.length === 0) return [];
    
    // Assuming initial bankroll is $1000 and divided equally among trades
    const initialInvestmentPerTrade = 1000 / orders.length;
    
    let cumulativeProfitWithoutFee = 0;
    let cumulativeProfitWithFee = 0;
    let totalInvestment = 0;
    
    // Reverse the orders to process from the last trade to the first
    const reversedOrders = [...orders].reverse();
    
    return reversedOrders.map((order, index) => {
      cumulativeProfitWithoutFee += order.profit;
      cumulativeProfitWithFee += order.profit - fee;
      totalInvestment = initialInvestmentPerTrade * (index + 1); // Total invested till current trade
      
      const returnPercentageWithoutFee = (cumulativeProfitWithoutFee / totalInvestment) * 100;
      const returnPercentageWithFee = (cumulativeProfitWithFee / totalInvestment) * 100;
      
      return {
        trade: index, // Adjust to reflect original trade index
        totalReturnPercentageWithoutFee: parseFloat(returnPercentageWithoutFee.toFixed(2)),
        totalReturnPercentageWithFee: parseFloat(returnPercentageWithFee.toFixed(2)),
      };
    });
  };
  
  const sortedOrders = useMemo(() => {
    return [...completedOrders].sort(
      (a, b) => new Date(a.exitDatetime) - new Date(b.exitDatetime)
    );
  }, [completedOrders]);
  
  const totalReturnData = useMemo(() => calculateTotalReturnPercentage(sortedOrders, fee), [sortedOrders, fee]);
  
  return (
    <div className="grid grid-cols-2 gap-4 bg-gray-800 p-4">
      <div className="col-span-2 bg-gray-900 p-4 rounded shadow">
        <label htmlFor="fee" className="text-white mr-2">
          Fee (%):
        </label>
        <input
          id="fee"
          type="number"
          value={fee}
          onChange={(e) => setFee(parseFloat(e.target.value) || 0)}
          className="bg-gray-700 text-white p-2 rounded"
          step="0.1"
          min="0"
        />
      </div>

      <div className="bg-gray-900 p-4 rounded shadow">
        <h3 className="text-lg font-semibold mb-2 text-white">
          Profit Over Trades
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Shows the profit percentage for each trade over time
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={profitData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="trade" stroke="#ddd" />
            <YAxis stroke="#ddd" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="profitWithoutFee"
              stroke="#82ca9d"
              activeDot={{ r: 8 }}
              name="Profit without Fee"
            />
            {fee > 0 && (
              <Line
                type="monotone"
                dataKey="profitWithFee"
                stroke="#8884d8"
                activeDot={{ r: 8 }}
                name="Profit with Fee"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-900 p-4 rounded shadow">
        <h3 className="text-lg font-semibold mb-2 text-white">
          Cumulative Profit Over Trades
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Shows the running sum of profit percentage over consecutive trades
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={runningProfitData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="trade" stroke="#ddd" />
            <YAxis
              stroke="#ddd"
              domain={[findMinCumulativeProfit(), findMaxCumulativeProfit()]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="cumulativeProfitWithoutFee"
              stroke="#82ca9d"
              activeDot={{ r: 8 }}
              name="Cumulative Profit without Fee"
            />
            {fee > 0 && (
              <Line
                type="monotone"
                dataKey="cumulativeProfitWithFee"
                stroke="#8884d8"
                activeDot={{ r: 8 }}
                name="Cumulative Profit with Fee"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Total Return Percentage Graph */}
      <div className="bg-gray-900 p-4 rounded shadow">
        <h3 className="text-lg font-semibold mb-2 text-white">Total Return Percentage</h3>
        <p className="text-sm text-gray-400 mb-4">
          Shows the total return percentage for all trades combined, assuming equal division of bankroll.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={totalReturnData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="trade" stroke="#ddd" />
            <YAxis stroke="#ddd" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="totalReturnPercentageWithoutFee"
              stroke="#82ca9d"
              activeDot={{ r: 8 }}
              name="Return Percentage without Fee"
            />
            {fee > 0 && (
              <Line
                type="monotone"
                dataKey="totalReturnPercentageWithFee"
                stroke="#8884d8"
                activeDot={{ r: 8 }}
                name="Return Percentage with Fee"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-900 p-4 rounded shadow">
        <h3 className="text-lg font-semibold mb-2 text-white">
          Profit Distribution
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Displays the distribution of profits across different ranges
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={distributionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="range" stroke="#ddd" />
            <YAxis stroke="#ddd" />
            <Tooltip />
            <Legend />
            <Bar dataKey="countWithoutFee" fill="#82ca9d" name="Without Fee" />
            {fee > 0 && <Bar dataKey="countWithFee" fill="#8884d8" name="With Fee" />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-900 p-4 rounded shadow">
        <h3 className="text-lg font-semibold mb-2 text-white">
          Holding Time vs Profit
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Scatter plot showing the relationship between holding time and profit
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid stroke="#444" />
            <XAxis
              type="number"
              dataKey="holdingTime"
              name="Holding Time (hours)"
              stroke="#ddd"
            />
            <YAxis
              type="number"
              dataKey="profitWithoutFee"
              name="Profit %"
              stroke="#ddd"
            />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Legend />
            <Scatter name="Without Fee" data={holdingTimeData} fill="#82ca9d" />
            {fee > 0 && (
              <Scatter
                name="With Fee"
                data={holdingTimeData}
                fill="#8884d8"
                dataKey="profitWithFee"
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-900 p-4 rounded shadow">
        <h3 className="text-lg font-semibold mb-2 text-white">
          Profit by Symbol
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Bar chart showing the total profit for each traded symbol
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={profitBySymbolData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="symbol" stroke="#ddd" />
            <YAxis stroke="#ddd" />
            <Tooltip />
            <Legend />
            <Bar dataKey="profitWithoutFee" fill="#82ca9d" name="Without Fee" />
            {fee > 0 && <Bar dataKey="profitWithFee" fill="#8884d8" name="With Fee" />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-900 p-4 rounded shadow">
        <h3 className="text-lg font-semibold mb-2 text-white">
          Profit by Stop Loss Type
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Bar chart showing the average profit for each stop loss type
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={profitByStopLossType}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="type" stroke="#ddd" />
            <YAxis stroke="#ddd" />
            <Tooltip />
            <Legend />
            <Bar dataKey="profitWithoutFee" fill="#82ca9d" name="Without Fee" />
            {fee > 0 && <Bar dataKey="profitWithFee" fill="#8884d8" name="With Fee" />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-900 p-4 rounded shadow">
        <h3 className="text-lg font-semibold mb-2 text-white">
          Win/Loss Ratio
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Pie chart showing the ratio of profitable trades to losing trades
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={[
                { name: "Wins", value: profitData.filter(trade => trade.profitWithFee >= 0).length },
                { name: "Losses", value: profitData.filter(trade => trade.profitWithFee < 0).length }
              ]}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              <Cell key="cell-0" fill="#82ca9d" />
              <Cell key="cell-1" fill="#ff6b6b" />
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default GraphsTab;