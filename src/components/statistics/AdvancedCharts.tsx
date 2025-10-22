'use client'

import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts'

interface ChartData {
  name: string
  value: number
  revenue?: number
  expenses?: number
  profit?: number
  [key: string]: any
}

interface AdvancedChartsProps {
  data: ChartData[]
  type: 'bar' | 'pie' | 'line' | 'area'
  title: string
  height?: number
  showLegend?: boolean
  colors?: string[]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export default function AdvancedCharts({
  data,
  type,
  title,
  height = 400,
  showLegend = true,
  colors = COLORS
}: AdvancedChartsProps) {
  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [
                typeof value === 'number' ? `$${value.toLocaleString()}` : value,
                name
              ]}
            />
            {showLegend && <Legend />}
            {data[0]?.revenue !== undefined && (
              <Bar dataKey="revenue" fill="#00C49F" name="수익" />
            )}
            {data[0]?.expenses !== undefined && (
              <Bar dataKey="expenses" fill="#FF8042" name="지출" />
            )}
            {data[0]?.profit !== undefined && (
              <Bar dataKey="profit" fill="#0088FE" name="순수익" />
            )}
            {data[0]?.revenue === undefined && data[0]?.expenses === undefined && data[0]?.profit === undefined && (
              <Bar dataKey="value" fill="#0088FE" />
            )}
          </BarChart>
        )

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
            {showLegend && <Legend />}
          </PieChart>
        )

      case 'line':
        return (
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [
                typeof value === 'number' ? `$${value.toLocaleString()}` : value,
                name
              ]}
            />
            {showLegend && <Legend />}
            {data[0]?.revenue !== undefined && (
              <Line type="monotone" dataKey="revenue" stroke="#00C49F" strokeWidth={2} name="수익" />
            )}
            {data[0]?.expenses !== undefined && (
              <Line type="monotone" dataKey="expenses" stroke="#FF8042" strokeWidth={2} name="지출" />
            )}
            {data[0]?.profit !== undefined && (
              <Line type="monotone" dataKey="profit" stroke="#0088FE" strokeWidth={2} name="순수익" />
            )}
            {data[0]?.revenue === undefined && data[0]?.expenses === undefined && data[0]?.profit === undefined && (
              <Line type="monotone" dataKey="value" stroke="#0088FE" strokeWidth={2} />
            )}
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [
                typeof value === 'number' ? `$${value.toLocaleString()}` : value,
                name
              ]}
            />
            {showLegend && <Legend />}
            {data[0]?.revenue !== undefined && (
              <Area type="monotone" dataKey="revenue" stackId="1" stroke="#00C49F" fill="#00C49F" name="수익" />
            )}
            {data[0]?.expenses !== undefined && (
              <Area type="monotone" dataKey="expenses" stackId="2" stroke="#FF8042" fill="#FF8042" name="지출" />
            )}
            {data[0]?.profit !== undefined && (
              <Area type="monotone" dataKey="profit" stackId="3" stroke="#0088FE" fill="#0088FE" name="순수익" />
            )}
            {data[0]?.revenue === undefined && data[0]?.expenses === undefined && data[0]?.profit === undefined && (
              <Area type="monotone" dataKey="value" stroke="#0088FE" fill="#0088FE" />
            )}
          </AreaChart>
        )

      default:
        return null
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  )
}
