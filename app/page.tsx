'use client';

import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

type RawRow = {
  Date?: string;
  Sales?: string;
  'Sales Person'?: string;
  Client?: string;
  Revenue?: string;
  State?: string;
};

type AggregatedRow = {
  Date: string;
  SalesCount: number;
  Revenue: number;
  Clients: string[];
  Month: string;
  Year: string;
};

const COLORS = ['#00bfff', '#ffaa00', '#00ffaa', '#ff5555', '#ff33cc', '#ff9933'];

type WeekRange = {
  start: string; // YYYY-MM-DD
  end: string;
};

// Generate all week ranges inside a given month (e.g. "April 2024")
function getWeeksOfMonth(monthYear: string): WeekRange[] {
  const [monthName, year] = monthYear.split(' ');
  const startOfMonth = dayjs(`${monthName} 1, ${year}`).startOf('month');
  const endOfMonth = startOfMonth.endOf('month');

  const weeks: WeekRange[] = [];
  let current = startOfMonth;

  while (current.isBefore(endOfMonth) || current.isSame(endOfMonth, 'day')) {
    const weekStart = current;
    let weekEnd = weekStart.endOf('week');
    if (weekEnd.isAfter(endOfMonth)) {
      weekEnd = endOfMonth;
    }

    weeks.push({
      start: weekStart.format('YYYY-MM-DD'),
      end: weekEnd.format('YYYY-MM-DD'),
    });

    current = weekEnd.add(1, 'day');
  }

  return weeks;
}

export default function DashboardPage() {
  const [data, setData] = useState<AggregatedRow[]>([]);
  const [filteredData, setFilteredData] = useState<AggregatedRow[]>([]);
  const [salesByPerson, setSalesByPerson] = useState<{ name: string; revenue: number }[]>([]);
  const [filter, setFilter] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<WeekRange | null>(null);

  // NEW: which chart is visible
  const [selectedChart, setSelectedChart] = useState<'sales' | 'revenue' | 'person'>('sales');

  // NEW: year filter for Revenue Over Time
  const [selectedYear, setSelectedYear] = useState<string>('all');

  async function fetchData() {
    try {
      const res = await fetch('/api/dashboard-data');
      const json = await res.json();
      const sheetData: RawRow[] = json.data || [];

      const validRows = sheetData.filter((r) => r.Date && r.Revenue);

      const dailyMap: Record<string, AggregatedRow> = {};
      const personMap: Record<string, number> = {};

      validRows.forEach((row) => {
        const dateObj = dayjs(row.Date);
        const date = dateObj.isValid() ? dateObj.format('YYYY-MM-DD') : 'Unknown';
        const month = dateObj.isValid() ? dateObj.format('MMMM') : 'Unknown';
        const year = dateObj.isValid() ? dateObj.format('YYYY') : 'Unknown';

        if (!dailyMap[date]) {
          dailyMap[date] = {
            Date: date,
            Month: month,
            Year: year,
            SalesCount: 0,
            Revenue: 0,
            Clients: [],
          };
        }

        dailyMap[date].SalesCount += 1;
        dailyMap[date].Revenue += Number(row.Revenue) || 0;

        if (row.Client && !dailyMap[date].Clients.includes(row.Client)) {
          dailyMap[date].Clients.push(row.Client);
        }

        const person = row['Sales Person'] || 'Unknown';
        if (!personMap[person]) personMap[person] = 0;
        personMap[person] += Number(row.Revenue) || 0;
      });

      const aggregated = Object.values(dailyMap).sort((a, b) => a.Date.localeCompare(b.Date));
      const personArray = Object.entries(personMap).map(([name, revenue]) => ({
        name,
        revenue,
      }));

      const uniqueMonths = Array.from(new Set(aggregated.map((r) => `${r.Month} ${r.Year}`)));

      setData(aggregated);
      setFilteredData(aggregated);
      setSalesByPerson(personArray);
      setAvailableMonths(uniqueMonths);
    } catch (err) {
      console.error('❌ Error fetching or aggregating data:', err);
    }
  }

  // Reset selected week when month changes
  useEffect(() => {
    setSelectedWeek(null);
  }, [selectedMonth]);

  // Apply filters (daily / weekly / monthly / all + month + week)
  useEffect(() => {
    if (!data.length) return;

    let filtered = [...data];

    if (filter === 'daily') {
      const now = dayjs();
      filtered = data.filter((item) => dayjs(item.Date).isSame(now, 'day'));
    } else if (filter === 'weekly') {
      // If month is selected and week is picked → use that range
      if (selectedWeek && selectedMonth !== 'all') {
        const start = dayjs(selectedWeek.start);
        const end = dayjs(selectedWeek.end);

        filtered = data.filter((item) => {
          const d = dayjs(item.Date);
          return !d.isBefore(start) && !d.isAfter(end);
        });
      } else {
        // Default weekly → last 7 days
        const now = dayjs();
        filtered = data.filter((item) =>
          dayjs(item.Date).isAfter(now.subtract(7, 'day')),
        );
      }
    } else if (filter === 'monthly') {
      const now = dayjs();
      filtered = data.filter((item) =>
        dayjs(item.Date).isAfter(now.subtract(30, 'day')),
      );
    } else {
      filtered = [...data];
    }

    // Apply month filter for everything except custom weekly (because week is already inside the month)
    if (selectedMonth !== 'all' && filter !== 'weekly') {
      filtered = filtered.filter((r) => `${r.Month} ${r.Year}` === selectedMonth);
    }

    setFilteredData(filtered);
  }, [filter, data, selectedMonth, selectedWeek]);

  // Auto-refresh data
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalSales = filteredData.reduce((sum, r) => sum + r.SalesCount, 0);
  const totalRevenue = filteredData.reduce((sum, r) => sum + r.Revenue, 0);
  const totalClients = filteredData.reduce((sum, r) => sum + r.Clients.length, 0);

  const weeks =
    selectedMonth !== 'all'
      ? getWeeksOfMonth(selectedMonth)
      : [];

  // Available years for year dropdown (Revenue Over Time)
  const availableYears = Array.from(new Set(data.map((r) => r.Year))).filter(
    (y) => y && y !== 'Unknown',
  );

  // Month-wise revenue for Revenue Over Time (grouped by Month + Year)
  const revenueByMonth = Object.values(
    filteredData.reduce((acc: Record<string, { Month: string; Revenue: number }>, row) => {
      const year = row.Year;
      const month = row.Month;

      // Apply year filter
      if (selectedYear !== 'all' && selectedYear !== year) return acc;

      const key = `${month} ${year}`;
      if (!acc[key]) {
        acc[key] = { Month: key, Revenue: 0 };
      }
      acc[key].Revenue += row.Revenue;
      return acc;
    }, {}),
  ).sort(
    (a, b) =>
      dayjs(a.Month, 'MMMM YYYY').toDate().getTime() -
      dayjs(b.Month, 'MMMM YYYY').toDate().getTime(),
  );

  return (
    <>
      {/* Week Picker Modal */}
      {showWeekPicker && selectedMonth !== 'all' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 w-80 p-6 rounded-2xl shadow-xl border border-slate-700">
            <h2 className="text-xl font-bold mb-2 text-center">
              Select Week – {selectedMonth}
            </h2>
            <p className="text-xs text-gray-400 text-center mb-4">
              Choose a week inside {selectedMonth} to update the dashboard.
            </p>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {weeks.map((week, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedWeek(week);
                    setShowWeekPicker(false);
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-lg transition text-sm text-left px-3"
                >
                  <div className="font-semibold">Week {i + 1}</div>
                  <div className="text-xs text-gray-300">
                    {dayjs(week.start).format('DD MMM YYYY')} →{' '}
                    {dayjs(week.end).format('DD MMM YYYY')}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowWeekPicker(false)}
              className="mt-4 bg-red-600 hover:bg-red-500 w-full py-2 rounded-lg text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Dashboard */}
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <h1 className="text-3xl font-bold mb-2">
          📊 Gobind Coach Builders — Live Sales Dashboard
        </h1>

        {filter === 'weekly' && selectedWeek && selectedMonth !== 'all' && (
          <p className="text-sm text-gray-300 mb-4">
            Showing data for{' '}
            <span className="font-semibold">
              {dayjs(selectedWeek.start).format('DD MMM YYYY')} –{' '}
              {dayjs(selectedWeek.end).format('DD MMM YYYY')}
            </span>{' '}
            ({selectedMonth})
          </p>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex gap-3 flex-wrap">
            {/* Daily */}
            <button
              onClick={() => {
                setFilter('daily');
                setSelectedWeek(null);
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filter === 'daily'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-700/40'
                  : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              Today
            </button>

            {/* Weekly */}
            <button
              onClick={() => {
                setFilter('weekly');
                if (selectedMonth !== 'all') {
                  setShowWeekPicker(true);
                } else {
                  setSelectedWeek(null); // last 7 days mode
                }
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filter === 'weekly'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-700/40'
                  : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              This Week
            </button>

            {/* Monthly (rolling 30 days) */}
            <button
              onClick={() => {
                setFilter('monthly');
                setSelectedWeek(null);
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filter === 'monthly'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-700/40'
                  : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              This Month
            </button>

            {/* All data */}
            <button
              onClick={() => {
                setFilter('all');
                setSelectedWeek(null);
              }}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-700/40'
                  : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              All Data
            </button>
          </div>

          {/* Month Dropdown */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm font-semibold"
          >
            <option value="all">All Months</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Stats Row */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="bg-slate-900 rounded-2xl p-6 text-center shadow-xl shadow-black/40">
            <p className="text-gray-400 text-sm">Total Sales Entries</p>
            <p className="text-4xl font-bold text-blue-400">{totalSales}</p>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 text-center shadow-xl shadow-black/40">
            <p className="text-gray-400 text-sm">Total Revenue</p>
            <p className="text-4xl font-bold text-green-400">
              ₹{totalRevenue.toLocaleString()}
            </p>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 text-center shadow-xl shadow-black/40">
            <p className="text-gray-400 text-sm">Unique Clients</p>
            <p className="text-4xl font-bold text-yellow-400">{totalClients}</p>
          </div>
        </div>

        {/* Chart Selection + Year Dropdown */}
        <div className="mb-6 flex gap-4 items-center flex-wrap">
          {/* Chart Type Dropdown */}
          <select
            value={selectedChart}
            onChange={(e) =>
              setSelectedChart(e.target.value as 'sales' | 'revenue' | 'person')
            }
            className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm font-semibold"
          >
            <option value="sales">Sales Entries Per Day</option>
            <option value="revenue">Revenue Over Time</option>
            <option value="person">Revenue By Sales Person</option>
          </select>

          {/* Year Dropdown ONLY for Revenue Over Time */}
          {selectedChart === 'revenue' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-sm font-semibold"
            >
              <option value="all">All Years</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Selected Chart */}
        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg">
          {selectedChart === 'sales' && (
            <>
              <h2 className="text-lg font-semibold mb-3">Sales Entries Per Day</h2>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={filteredData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="Date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="SalesCount" fill="#00bfff" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {selectedChart === 'revenue' && (
            <>
              <h2 className="text-lg font-semibold mb-3">
                Revenue Over Time (Month-wise)
                {selectedYear !== 'all' && ` – ${selectedYear}`}
              </h2>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="Month" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="Revenue"
                      stroke="#00ffaa"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {selectedChart === 'person' && (
            <>
              <h2 className="text-lg font-semibold mb-3">Revenue by Sales Person</h2>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={salesByPerson}
                      dataKey="revenue"
                      nameKey="name"
                      outerRadius={100}
                      label
                    >
                      {salesByPerson.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
