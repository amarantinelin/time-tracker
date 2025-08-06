"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, Play, Pause, Plus, Settings, Target, CheckCircle, Circle, Timer, BarChart3, Zap, PieChart, Calendar, ChevronLeft, ChevronRight, CalendarDays, MapPin, Users, Download } from 'lucide-react'

interface Task {
  id: string
  title: string
  duration: number // in minutes
  color: string
  tag: string
  completed: boolean
  startTime?: Date
  endTime?: Date
  fromCalendar?: boolean // Track if task came from calendar
  calendarEventId?: string // Link to original calendar event
}

interface TimeBlock {
  id: string
  hour: number
  tasks: Task[]
  blockDuration: number // in minutes
}

interface DailyGoal {
  id: string
  title: string
  completed: boolean
  subtasks: Task[]
}

interface UnscheduledTodo {
  id: string
  title: string
  duration: number
  color: string
  tag: string
  priority: "low" | "medium" | "high"
  assignedToGoal?: string
}

interface CalendarEvent {
  id: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  type: "meeting" | "appointment" | "personal" | "work" | "other"
  location?: string
  attendees?: string[]
  color: string
}

export default function TimeTracker() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([])
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([])
  const [defaultBlockDuration, setDefaultBlockDuration] = useState(10)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [sessionTime, setSessionTime] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [showInterventionDialog, setShowInterventionDialog] = useState(false)
  const [newTaskDialog, setNewTaskDialog] = useState(false)
  const [selectedHour, setSelectedHour] = useState(0)
  const [newGoalDialog, setNewGoalDialog] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [unscheduledTodos, setUnscheduledTodos] = useState<UnscheduledTodo[]>([])
  const [draggedTodo, setDraggedTodo] = useState<UnscheduledTodo | null>(null)
  const [newTodoDialog, setNewTodoDialog] = useState(false)

  const [editTaskDialog, setEditTaskDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingTaskHour, setEditingTaskHour] = useState<number | null>(null)

  const [durationPresets, setDurationPresets] = useState<number[]>([])
  const [managePresetsDialog, setManagePresetsDialog] = useState(false)
  const [newPresetValue, setNewPresetValue] = useState("")

  // Calendar state
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [currentView, setCurrentView] = useState<"daily" | "weekly" | "monthly">("daily")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [newEventDialog, setNewEventDialog] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)

  const getEventsForDate = (date: Date) => {
    return calendarEvents.filter((event) => {
      const eventDate = new Date(event.startTime)
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      )
    })
  }

  // Auto-sync calendar events to daily time blocks with proper duration spanning
  const syncCalendarToBlocks = () => {
    const today = new Date()
    const todayEvents = getEventsForDate(today)

    // Remove existing calendar-synced tasks
    setTimeBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        tasks: block.tasks.filter((task) => !task.fromCalendar),
      }))
    )

    // Add calendar events as tasks with proper duration spanning
    todayEvents.forEach((event) => {
      const eventStart = new Date(event.startTime)
      const eventEnd = new Date(event.endTime)
      const startHour = eventStart.getHours()
      const startMinute = eventStart.getMinutes()
      const totalDurationMinutes = Math.ceil((eventEnd.getTime() - eventStart.getTime()) / (1000 * 60))
      
      // Calculate how the event should be distributed across time blocks
      const eventTasks: { hour: number; duration: number; title: string }[] = []
      
      let remainingDuration = totalDurationMinutes
      let currentHour = startHour
      let currentMinute = startMinute
      
      while (remainingDuration > 0) {
        // Calculate available time in current hour block
        const minutesUsedInCurrentHour = currentMinute
        const availableInCurrentHour = 60 - minutesUsedInCurrentHour
        
        // Determine how much of the event fits in this hour
        const durationForThisHour = Math.min(remainingDuration, availableInCurrentHour)
        
        if (durationForThisHour > 0) {
          // Create task title with time indication for multi-hour events
          let taskTitle = event.title
          if (totalDurationMinutes > 60) {
            const partNumber = eventTasks.length + 1
            const totalParts = Math.ceil(totalDurationMinutes / 60)
            taskTitle = `${event.title} (${partNumber}/${totalParts})`
          }
          
          eventTasks.push({
            hour: currentHour,
            duration: durationForThisHour,
            title: taskTitle
          })
          
          remainingDuration -= durationForThisHour
        }
        
        // Move to next hour
        currentHour = (currentHour + 1) % 24
        currentMinute = 0 // Reset minutes for subsequent hours
      }

      // Create tasks for each hour block
      eventTasks.forEach((eventTask, index) => {
        const calendarTask: Task = {
          id: `calendar-task-${event.id}-${index}`,
          title: eventTask.title,
          duration: eventTask.duration,
          color: event.color,
          tag: event.type,
          completed: false,
          fromCalendar: true,
          calendarEventId: event.id,
        }

        setTimeBlocks((prev) =>
          prev.map((block) =>
            block.hour === eventTask.hour
              ? { 
                  ...block, 
                  tasks: [...block.tasks.filter((t) => !t.fromCalendar || t.calendarEventId !== event.id), calendarTask] 
                }
              : block
          )
        )
      })
    })
  }

  // Initialize time blocks for 24 hours (one-time only)
  useEffect(() => {
    const blocks: TimeBlock[] = []
    for (let i = 0; i < 24; i++) {
      blocks.push({
        id: `block-${i}`,
        hour: i,
        tasks: [],
        blockDuration: 10, // Default value, doesn't need to be reactive
      })
    }
    setTimeBlocks(blocks)
  }, []) // Empty dependency array - runs only once on mount

  // Auto-sync calendar events to daily blocks when enabled
  useEffect(() => {
    if (autoSyncEnabled) {
      syncCalendarToBlocks()
    }
  }, [calendarEvents, autoSyncEnabled])

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Session timer - change to countdown
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning && activeTask) {
      interval = setInterval(() => {
        setSessionTime((prev) => {
          const newTime = Math.max(0, prev - 1)
          // Check if countdown reached 0
          if (newTime <= 0) {
            setShowInterventionDialog(true)
            setIsRunning(false)
          }
          return newTime
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, activeTask])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const getCurrentHour = () => currentTime.getHours()
  const getCurrentMinute = () => currentTime.getMinutes()

  const formatTime = (seconds: number) => {
    const hours = Math.floor(Math.max(0, seconds) / 3600)
    const minutes = Math.floor((Math.max(0, seconds) % 3600) / 60)
    const secs = Math.max(0, seconds) % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${Math.floor(secs).toString().padStart(2, "0")}`
  }

  const addTask = (hour: number, task: Omit<Task, "id">) => {
    const targetBlock = timeBlocks.find((block) => block.hour === hour)

    if (!targetBlock || !canScheduleTask(targetBlock, task.duration)) {
      alert(`Cannot add task: Only ${getBlockRemainingTime(targetBlock!)} minutes remaining in this hour block.`)
      return
    }

    const newTask: Task = {
      ...task,
      id: `task-${Date.now()}-${Math.random()}`,
    }

    setTimeBlocks((prev) =>
      prev.map((block) => (block.hour === hour ? { ...block, tasks: [...block.tasks, newTask] } : block)),
    )
  }

  const startTask = (task: Task) => {
    setActiveTask(task)
    setSessionTime(task.duration * 60) // Set to full duration for countdown
    setIsRunning(true)
  }

  const completeTask = (taskId: string) => {
    setTimeBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        tasks: block.tasks.map((task) =>
          task.id === taskId ? { ...task, completed: true, endTime: new Date() } : task,
        ),
      })),
    )

    if (activeTask?.id === taskId) {
      setActiveTask(null)
      setIsRunning(false)
      setSessionTime(0)
    }
  }

  const addDailyGoal = (title: string) => {
    const newGoal: DailyGoal = {
      id: `goal-${Date.now()}`,
      title,
      completed: false,
      subtasks: [],
    }
    setDailyGoals((prev) => [...prev, newGoal])
  }

  const toggleGoal = (goalId: string) => {
    setDailyGoals((prev) => prev.map((goal) => (goal.id === goalId ? { ...goal, completed: !goal.completed } : goal)))
  }

  const getCompletedTasksCount = () => {
    return timeBlocks.reduce((count, block) => count + block.tasks.filter((task) => task.completed).length, 0)
  }

  const getTotalTasksCount = () => {
    return timeBlocks.reduce((count, block) => count + block.tasks.length, 0)
  }

  const getProductivityScore = () => {
    const total = getTotalTasksCount()
    const completed = getCompletedTasksCount()
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }

  const getBlockStatus = (hour: number) => {
    const currentHour = getCurrentHour()
    if (hour < currentHour) return "past"
    if (hour === currentHour) return "present"
    return "future"
  }

  const getBlockColor = (status: string) => {
  switch (status) {
    case "past":
      return "bg-gradient-to-br from-purple-100 to-pink-100 border-purple-300"
    case "present":
      return "bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 border-emerald-400 shadow-xl shadow-emerald-300/50 animate-pulse"
    case "future":
      return "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200"
    default:
      return "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200"
  }
}

  // Get the elapsed percentage of the current hour
  const getCurrentHourProgress = () => {
    const currentMinute = getCurrentMinute()
    return (currentMinute / 60) * 100
  }

  // Get remaining minutes in current hour
  const getRemainingMinutesInCurrentHour = () => {
    return 60 - getCurrentMinute()
  }

  const addUnscheduledTodo = (todo: Omit<UnscheduledTodo, "id">) => {
    const newTodo: UnscheduledTodo = {
      ...todo,
      id: `todo-${Date.now()}`,
    }
    setUnscheduledTodos((prev) => [...prev, newTodo])
  }

  const removeUnscheduledTodo = (todoId: string) => {
    setUnscheduledTodos((prev) => prev.filter((todo) => todo.id !== todoId))
  }

  const getBlockTotalTime = (block: TimeBlock) => {
    return block.tasks.reduce((total, task) => total + task.duration, 0)
  }

  const getBlockRemainingTime = (block: TimeBlock) => {
    return Math.max(0, 60 - getBlockTotalTime(block))
  }

  const canScheduleTask = (block: TimeBlock, taskDuration: number) => {
    return getBlockTotalTime(block) + taskDuration <= 60
  }

  const scheduleTask = (todo: UnscheduledTodo, hour: number) => {
    const targetBlock = timeBlocks.find((block) => block.hour === hour)

    if (!targetBlock || !canScheduleTask(targetBlock, todo.duration)) {
      alert(`Cannot add task: Only ${getBlockRemainingTime(targetBlock!)} minutes remaining in this hour block.`)
      return
    }

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: todo.title,
      duration: todo.duration,
      color: todo.color,
      tag: todo.tag,
      completed: false,
    }

    setTimeBlocks((prev) =>
      prev.map((block) => (block.hour === hour ? { ...block, tasks: [...block.tasks, newTask] } : block)),
    )

    removeUnscheduledTodo(todo.id)
  }

  const handleDragStart = (e: React.DragEvent, todo: UnscheduledTodo) => {
    setDraggedTodo(todo)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, hour: number) => {
    e.preventDefault()
    if (draggedTodo) {
      scheduleTask(draggedTodo, hour)
      setDraggedTodo(null)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 border-red-300"
      case "medium":
        return "bg-yellow-100 border-yellow-300"
      case "low":
        return "bg-green-100 border-green-300"
      default:
        return "bg-gray-100 border-gray-300"
    }
  }

  const addTodoToGoal = (todo: UnscheduledTodo, goalId: string) => {
    const newSubtask: Task = {
      id: `subtask-${Date.now()}`,
      title: todo.title,
      duration: todo.duration,
      color: todo.color,
      tag: todo.tag,
      completed: false,
    }

    setDailyGoals((prev) =>
      prev.map((goal) => (goal.id === goalId ? { ...goal, subtasks: [...goal.subtasks, newSubtask] } : goal)),
    )

    setUnscheduledTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, assignedToGoal: goalId } : t)))
  }

  const updateTask = (hour: number, taskId: string, updatedTask: Partial<Task>) => {
    setTimeBlocks((prev) =>
      prev.map((block) =>
        block.hour === hour
          ? {
              ...block,
              tasks: block.tasks.map((task) => (task.id === taskId ? { ...task, ...updatedTask } : task)),
            }
          : block,
      ),
    )
  }

  const deleteTask = (hour: number, taskId: string) => {
    setTimeBlocks((prev) =>
      prev.map((block) =>
        block.hour === hour
          ? {
              ...block,
              tasks: block.tasks.filter((task) => task.id !== taskId),
            }
          : block,
      ),
    )
  }

  const openEditTask = (task: Task, hour: number) => {
    setEditingTask(task)
    setEditingTaskHour(hour)
    setEditTaskDialog(true)
  }

  const addDurationPreset = (duration: number) => {
    if (duration > 0 && duration <= 120 && !getAllDurations().includes(duration)) {
      setDurationPresets((prev) => [...prev, duration].sort((a, b) => a - b))
    }
  }

  const removeDurationPreset = (duration: number) => {
    setDurationPresets((prev) => prev.filter((d) => d !== duration))
  }

  const getDefaultDurations = () => [3, 5, 10, 15, 20, 25, 30, 45, 60]

  const getAllDurations = () => {
    const combined = [...getDefaultDurations(), ...durationPresets]
    return [...new Set(combined)].sort((a, b) => a - b)
  }

  const renderDurationOptions = () => {
    return getAllDurations().map((duration) => (
      <SelectItem key={duration} value={duration.toString()}>
        {duration} minutes
        {!getDefaultDurations().includes(duration) && <span className="text-xs text-blue-600 ml-1">(custom)</span>}
      </SelectItem>
    ))
  }

  const quickFillBlock = (hour: number) => {
    const targetBlock = timeBlocks.find((block) => block.hour === hour)
    if (!targetBlock) return

    const remainingTime = getBlockRemainingTime(targetBlock)
    const slotsToCreate = Math.floor(remainingTime / defaultBlockDuration)

    if (slotsToCreate === 0) {
      alert("No space available for more tasks in this block")
      return
    }

    const newTasks: Task[] = []
    for (let i = 0; i < slotsToCreate; i++) {
      newTasks.push({
        id: `task-${Date.now()}-${i}`,
        title: `Task ${i + 1}`,
        duration: defaultBlockDuration,
        color: "#3b82f6",
        tag: "General",
        completed: false,
      })
    }

    setTimeBlocks((prev) =>
      prev.map((block) => (block.hour === hour ? { ...block, tasks: [...block.tasks, ...newTasks] } : block)),
    )
  }

  const getDailyTimeAnalytics = () => {
    const allTasks = timeBlocks.flatMap((block) => block.tasks)
    const completedTasks = allTasks.filter((task) => task.completed)

    const timeByCategory: Record<string, { planned: number; completed: number }> = {}
    allTasks.forEach((task) => {
      if (!timeByCategory[task.tag]) {
        timeByCategory[task.tag] = { planned: 0, completed: 0 }
      }
      timeByCategory[task.tag].planned += task.duration
      if (task.completed) {
        timeByCategory[task.tag].completed += task.duration
      }
    })

    const timeByGoal: Record<string, { planned: number; completed: number }> = {}
    dailyGoals.forEach((goal) => {
      timeByGoal[goal.title] = { planned: 0, completed: 0 }
      goal.subtasks.forEach((subtask) => {
        timeByGoal[goal.title].planned += subtask.duration
        if (subtask.completed) {
          timeByGoal[goal.title].completed += subtask.duration
        }
      })
    })

    const totalPlannedTime = allTasks.reduce((sum, task) => sum + task.duration, 0)
    const totalCompletedTime = completedTasks.reduce((sum, task) => sum + task.duration, 0)

    return {
      timeByCategory,
      timeByGoal,
      totalPlannedTime,
      totalCompletedTime,
      completedTasks: completedTasks.length,
      totalTasks: allTasks.length,
    }
  }

  // Calendar functions
  const addCalendarEvent = (event: Omit<CalendarEvent, "id">) => {
    const newEvent: CalendarEvent = {
      ...event,
      id: `event-${Date.now()}`,
    }
    setCalendarEvents((prev) => [...prev, newEvent])
  }

  const updateCalendarEvent = (eventId: string, updatedEvent: Partial<CalendarEvent>) => {
    setCalendarEvents((prev) =>
      prev.map((event) => (event.id === eventId ? { ...event, ...updatedEvent } : event)),
    )
  }

  const deleteCalendarEvent = (eventId: string) => {
    setCalendarEvents((prev) => prev.filter((event) => event.id !== eventId))
    
    // Also remove any synced tasks from time blocks
    if (autoSyncEnabled) {
      setTimeBlocks((prev) =>
        prev.map((block) => ({
          ...block,
          tasks: block.tasks.filter((task) => task.calendarEventId !== eventId),
        }))
      )
    }
  }

  const importEventToTimeBlocks = (event: CalendarEvent) => {
    const eventDate = new Date(event.startTime)
    const today = new Date()

    // Only import events for today
    if (
      eventDate.getDate() !== today.getDate() ||
      eventDate.getMonth() !== today.getMonth() ||
      eventDate.getFullYear() !== today.getFullYear()
    ) {
      alert("Can only import today's events to time blocks")
      return
    }

    const eventStart = new Date(event.startTime)
    const eventEnd = new Date(event.endTime)
    const startHour = eventStart.getHours()
    const startMinute = eventStart.getMinutes()
    const totalDurationMinutes = Math.ceil((eventEnd.getTime() - eventStart.getTime()) / (1000 * 60))
    
    // Calculate how the event should be distributed across time blocks
    const eventTasks: { hour: number; duration: number; title: string }[] = []
    
    let remainingDuration = totalDurationMinutes
    let currentHour = startHour
    let currentMinute = startMinute
    
    while (remainingDuration > 0) {
      // Calculate available time in current hour block
      const minutesUsedInCurrentHour = currentMinute
      const availableInCurrentHour = 60 - minutesUsedInCurrentHour
      
      // Determine how much of the event fits in this hour
      const durationForThisHour = Math.min(remainingDuration, availableInCurrentHour)
      
      if (durationForThisHour > 0) {
        // Create task title with time indication for multi-hour events
        let taskTitle = event.title
        if (totalDurationMinutes > 60) {
          const partNumber = eventTasks.length + 1
          const totalParts = Math.ceil(totalDurationMinutes / 60)
          taskTitle = `${event.title} (${partNumber}/${totalParts})`
        }
        
        eventTasks.push({
          hour: currentHour,
          duration: durationForThisHour,
          title: taskTitle
        })
        
        remainingDuration -= durationForThisHour
      }
      
      // Move to next hour
      currentHour = (currentHour + 1) % 24
      currentMinute = 0 // Reset minutes for subsequent hours
    }

    // Create tasks for each hour block
    eventTasks.forEach((eventTask, index) => {
      addTask(eventTask.hour, {
        title: eventTask.title,
        duration: eventTask.duration,
        color: event.color,
        tag: event.type,
        completed: false,
        fromCalendar: true,
        calendarEventId: event.id,
      })
    })
  }

  // Manual sync function
  const manualSyncCalendar = () => {
    syncCalendarToBlocks()
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "meeting":
        return "#3b82f6"
      case "appointment":
        return "#10b981"
      case "personal":
        return "#f59e0b"
      case "work":
        return "#8b5cf6"
      default:
        return "#6b7280"
    }
  }

  const renderMonthlyCalendar = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const days = []
    const current = new Date(startDate)

    for (let i = 0; i < 42; i++) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-2 text-center font-semibold text-gray-600 bg-gray-50">
              {day}
            </div>
          ))}

          {days.map((day, index) => {
            const isCurrentMonth = day.getMonth() === month
            const isToday =
              day.getDate() === new Date().getDate() &&
              day.getMonth() === new Date().getMonth() &&
              day.getFullYear() === new Date().getFullYear()
            const events = getEventsForDate(day)

            return (
              <div
                key={index}
                className={`min-h-[100px] p-2 border cursor-pointer hover:bg-gray-50 ${
                  isCurrentMonth ? "bg-white" : "bg-gray-100 text-gray-400"
                } ${isToday ? "ring-2 ring-blue-500" : ""}`}
                onClick={() => {
                  setSelectedDate(day)
                  setNewEventDialog(true)
                }}
              >
                <div className="font-semibold">{day.getDate()}</div>
                <div className="space-y-1 mt-1">
                  {events.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className="text-xs p-1 rounded truncate"
                      style={{ backgroundColor: event.color + "20", borderLeft: `2px solid ${event.color}` }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingEvent(event)
                        setNewEventDialog(true)
                      }}
                    >
                      {event.title}
                    </div>
                  ))}
                  {events.length > 3 && (
                    <div className="text-xs text-gray-500">+{events.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

const renderWeeklyCalendar = () => {
  const startOfWeek = new Date(currentDate)
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())

  const weekDays = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek)
    day.setDate(startOfWeek.getDate() + i)
    weekDays.push(day)
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Helper function to calculate event positioning
  const getEventPosition = (event: CalendarEvent) => {
    const startTime = new Date(event.startTime)
    const endTime = new Date(event.endTime)
    const startHour = startTime.getHours()
    const startMinute = startTime.getMinutes()
    const endHour = endTime.getHours()
    const endMinute = endTime.getMinutes()
    
    // Calculate the starting position within the hour (0-1)
    const startOffset = startMinute / 60
    
    // Calculate total duration in hours
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    
    return {
      startHour,
      startOffset,
      durationHours,
      height: Math.max(durationHours * 60, 30) // Minimum 30px height
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          Week of {startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newDate = new Date(currentDate)
              newDate.setDate(currentDate.getDate() - 7)
              setCurrentDate(newDate)
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            This Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newDate = new Date(currentDate)
              newDate.setDate(currentDate.getDate() + 7)
              setCurrentDate(newDate)
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {/* Header with days */}
        <div className="grid grid-cols-8 bg-gray-50 border-b">
          <div className="p-3 text-center font-semibold text-gray-600 border-r">Time</div>
          {weekDays.map((day) => {
            const isToday =
              day.getDate() === new Date().getDate() &&
              day.getMonth() === new Date().getMonth() &&
              day.getFullYear() === new Date().getFullYear()

            return (
              <div
                key={day.toISOString()}
                className={`p-3 text-center font-semibold border-r last:border-r-0 ${
                  isToday ? "text-blue-600 bg-blue-50" : "text-gray-600"
                }`}
              >
                <div className="text-sm">{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
                <div className="text-lg font-bold">{day.getDate()}</div>
              </div>
            )
          })}
        </div>

        {/* Time grid */}
        <div className="relative max-h-[600px] overflow-y-auto">
          <div className="grid grid-cols-8">
            {hours.map((hour) => (
              <React.Fragment key={hour}>
                {/* Time label */}
                <div className="h-16 p-2 text-right text-sm text-gray-500 border-r border-b bg-gray-50 flex items-start">
                  {hour.toString().padStart(2, "0")}:00
                </div>
                
                {/* Day columns */}
                {weekDays.map((day, dayIndex) => {
                  const cellDate = new Date(day)
                  cellDate.setHours(hour, 0, 0, 0)
                  
                  // Get events that start in this hour for this day
                  const eventsInHour = calendarEvents.filter((event) => {
                    const eventStart = new Date(event.startTime)
                    return (
                      eventStart.getDate() === day.getDate() &&
                      eventStart.getMonth() === day.getMonth() &&
                      eventStart.getFullYear() === day.getFullYear() &&
                      eventStart.getHours() === hour
                    )
                  })

                  return (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className="relative h-16 border-r border-b last:border-r-0 cursor-pointer hover:bg-gray-50 group"
                      onClick={() => {
                        setSelectedDate(cellDate)
                        setNewEventDialog(true)
                      }}
                    >
                      {/* Add event button (shows on hover) */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="w-4 h-4 text-gray-400" />
                      </div>
                      
                      {/* Events */}
                      {eventsInHour.map((event) => {
                        const position = getEventPosition(event)
                        return (
                          <div
                            key={event.id}
                            className="absolute left-1 right-1 rounded text-xs p-1 cursor-pointer hover:shadow-md transition-shadow z-10 overflow-hidden"
                            style={{
                              backgroundColor: event.color + "20",
                              borderLeft: `3px solid ${event.color}`,
                              top: `${position.startOffset * 64}px`, // 64px = h-16
                              height: `${position.height}px`,
                              minHeight: '20px'
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingEvent(event)
                              setNewEventDialog(true)
                            }}
                          >
                            <div className="font-medium truncate">{event.title}</div>
                            <div className="text-xs text-gray-600 truncate">
                              {event.startTime.toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                              {position.durationHours >= 1 && (
                                <span>
                                  {" - "}
                                  {event.endTime.toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>
                            {event.location && (
                              <div className="text-xs text-gray-500 truncate flex items-center">
                                <MapPin className="w-2 h-2 mr-1" />
                                {event.location}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

  const analytics = getDailyTimeAnalytics()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Time Tracker</h1>
            <p className="text-gray-600">
              {currentTime.toLocaleDateString()} - {currentTime.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0">
              Current Block: {getCurrentHour()}:{getCurrentMinute().toString().padStart(2, "0")}
            </Badge>
            <Badge variant={isRunning ? "default" : "secondary"} className={isRunning ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white" : "bg-gradient-to-r from-gray-400 to-gray-500 text-white"}>
              Timer: {isRunning ? "ON" : "OFF"}
            </Badge>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Daily
            </TabsTrigger>
            <TabsTrigger value="weekly" className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Weekly
            </TabsTrigger>
            <TabsTrigger value="monthly" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Monthly
            </TabsTrigger>
          </TabsList>

          {/* Daily View */}
          <TabsContent value="daily" className="space-y-6">
            {/* Calendar Sync Controls */}
            <Card className="border-l-4 border-l-blue-500 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <Calendar className="w-5 h-5" />
                  Calendar Sync
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="autoSync"
                        checked={autoSyncEnabled}
                        onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="autoSync" className="text-sm font-medium">
                        Auto-sync calendar events to daily blocks
                      </label>
                    </div>
                    <Badge variant={autoSyncEnabled ? "default" : "secondary"}>
                      {autoSyncEnabled ? "ON" : "OFF"}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={manualSyncCalendar}
                    disabled={autoSyncEnabled}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Manual Sync
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {autoSyncEnabled 
                    ? "Calendar events are automatically distributed across time blocks based on duration"
                    : "Use manual sync to import today's calendar events into time blocks"
                  }
                </p>
              </CardContent>
            </Card>

            {/* Daily Time Summary */}
            <Card className="border-l-4 border-l-purple-500 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                <CardTitle className="flex items-center gap-2 text-purple-700">
                  <PieChart className="w-5 h-5" />
                  Daily Time Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Overall Stats */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">Overall</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Total Planned</span>
                        <Badge variant="outline">{analytics.totalPlannedTime} min</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Time Completed</span>
                        <Badge variant="default">{analytics.totalCompletedTime} min</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Completion Rate</span>
                        <Badge variant="secondary">
                          {analytics.totalPlannedTime > 0
                            ? Math.round((analytics.totalCompletedTime / analytics.totalPlannedTime) * 100)
                            : 0}
                          %
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Time by Category */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">By Category</h3>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {Object.entries(analytics.timeByCategory).map(([category, time]) => (
                        <div key={category} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{category}</span>
                            <span className="text-xs text-gray-500">
                              {time.completed}/{time.planned} min
                            </span>
                          </div>
                          <Progress
                            value={time.planned > 0 ? (time.completed / time.planned) * 100 : 0}
                            className="h-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Time by Goals */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">By Goals</h3>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {Object.entries(analytics.timeByGoal).length > 0 ? (
                        Object.entries(analytics.timeByGoal).map(([goal, time]) => (
                          <div key={goal} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium truncate">{goal}</span>
                              <span className="text-xs text-gray-500">
                                {time.completed}/{time.planned} min
                              </span>
                            </div>
                            <Progress
                              value={time.planned > 0 ? (time.completed / time.planned) * 100 : 0}
                              className="h-1"
                            />
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 italic">No goals with subtasks yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Today's Calendar Events */}
            <Card className="border-l-4 border-l-green-500 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <Calendar className="w-5 h-5" />
                  Today's Events
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedDate(new Date())
                    setEditingEvent(null)
                    setNewEventDialog(true)
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Event
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {getEventsForDate(new Date()).length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No events scheduled for today</p>
                      <p className="text-sm">Add events to plan your day better</p>
                    </div>
                  ) : (
                    getEventsForDate(new Date()).map((event) => {
                      const duration = Math.ceil((event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60))
                      const isMultiHour = duration > 60
                      
                      return (
                        <div
                          key={event.id}
                          className="p-3 rounded-lg border"
                          style={{ backgroundColor: event.color + "10", borderLeft: `4px solid ${event.color}` }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{event.title}</h4>
                              <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {event.startTime.toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                  {" - "}
                                  {event.endTime.toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {duration} min
                                </Badge>
                                {event.location && (
                                  <>
                                    <MapPin className="w-3 h-3" />
                                    <span>{event.location}</span>
                                  </>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {event.type}
                                </Badge>
                                {autoSyncEnabled && (
                                  <Badge variant="secondary" className="text-xs">
                                    {isMultiHour ? "Multi-block sync" : "Auto-synced"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {!autoSyncEnabled && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => importEventToTimeBlocks(event)}
                                className="ml-2"
                              >
                                Import to Blocks
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Daily Goals */}
            <Card className="border-l-4 border-l-orange-500 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <Target className="w-5 h-5" />
                  Daily Goals
                </CardTitle>
                <Dialog open={newGoalDialog} onOpenChange={setNewGoalDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Goal
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Daily Goal</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        try {
                          const formData = new FormData(e.currentTarget)
                          const title = formData.get("title") as string
                          if (title.trim()) {
                            addDailyGoal(title.trim())
                            setNewGoalDialog(false)
                            e.currentTarget.reset()
                          }
                        } catch (error) {
                          console.error("Error adding goal:", error)
                        }
                      }}
                    >
                      <div className="space-y-4">
                        <Input name="title" placeholder="Enter your goal..." required />
                        <Button type="submit" className="w-full">
                          Add Goal
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dailyGoals.slice(0, 3).map((goal) => (
                    <div
                      key={goal.id}
                      className="border rounded-lg p-4"
                      onDragOver={handleDragOver}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (draggedTodo) {
                          addTodoToGoal(draggedTodo, goal.id)
                          setDraggedTodo(null)
                        }
                      }}
                    >
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        onClick={() => toggleGoal(goal.id)}
                      >
                        {goal.completed ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                        <span className={`font-medium ${goal.completed ? "line-through text-gray-500" : ""}`}>
                          {goal.title}
                        </span>
                      </div>

                      {goal.subtasks.length > 0 && (
                        <div className="ml-7 mt-2 space-y-1">
                          {goal.subtasks.map((subtask) => (
                            <div
                              key={subtask.id}
                              className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-50"
                              style={{ backgroundColor: subtask.color + "10", borderLeft: `2px solid ${subtask.color}` }}
                            >
                              <input
                                type="checkbox"
                                checked={subtask.completed}
                                onChange={() => {
                                  setDailyGoals((prev) =>
                                    prev.map((g) =>
                                      g.id === goal.id
                                        ? {
                                            ...g,
                                            subtasks: g.subtasks.map((st) =>
                                              st.id === subtask.id ? { ...st, completed: !st.completed } : st,
                                            ),
                                          }
                                        : g,
                                    ),
                                  )
                                }}
                                className="w-3 h-3"
                              />
                              <span className={subtask.completed ? "line-through text-gray-500" : ""}>
                                {subtask.title}
                              </span>
                              <Badge variant="outline" className="text-xs ml-auto">
                                {subtask.duration}min
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      {draggedTodo && (
                        <div className="mt-2 p-2 bg-blue-50 border border-dashed border-blue-300 rounded text-center text-xs text-blue-600">
                          Drop todo here to add as subtask
                        </div>
                      )}
                    </div>
                  ))}

                  {dailyGoals.length === 0 && (
                    <div className="text-center text-gray-500 py-4">
                      No goals set for today. Add your top 3 goals to get started!
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Todo List */}
            <Card className="border-l-4 border-l-pink-500 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-pink-50 to-rose-50 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-pink-700">
                  <Circle className="w-5 h-5" />
                  Unscheduled Todos
                </CardTitle>
                <Dialog open={newTodoDialog} onOpenChange={setNewTodoDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Todo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Todo</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        try {
                          const formData = new FormData(e.currentTarget)
                          const title = formData.get("title") as string
                          const duration = Number.parseInt(formData.get("duration") as string)
                          const color = formData.get("color") as string
                          const tag = formData.get("tag") as string
                          const priority = formData.get("priority") as "low" | "medium" | "high"

                          if (title.trim() && !isNaN(duration)) {
                            addUnscheduledTodo({
                              title: title.trim(),
                              duration,
                              color,
                              tag: tag.trim() || "General",
                              priority,
                            })
                            setNewTodoDialog(false)
                            e.currentTarget.reset()
                          }
                        } catch (error) {
                          console.error("Error adding todo:", error)
                        }
                      }}
                    >
                      <div className="space-y-4">
                        <Input name="title" placeholder="Todo title..." required />
                        <Select name="duration" defaultValue="25">
                          <SelectTrigger>
                            <SelectValue placeholder="Duration" />
                          </SelectTrigger>
                          <SelectContent>{renderDurationOptions()}</SelectContent>
                        </Select>
                        <Select name="priority" defaultValue="medium">
                          <SelectTrigger>
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High Priority</SelectItem>
                            <SelectItem value="medium">Medium Priority</SelectItem>
                            <SelectItem value="low">Low Priority</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select name="color" defaultValue="#3b82f6">
                          <SelectTrigger>
                            <SelectValue placeholder="Color" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="#3b82f6">Blue</SelectItem>
                            <SelectItem value="#10b981">Green</SelectItem>
                            <SelectItem value="#f59e0b">Yellow</SelectItem>
                            <SelectItem value="#ef4444">Red</SelectItem>
                            <SelectItem value="#8b5cf6">Purple</SelectItem>
                            <SelectItem value="#06b6d4">Cyan</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input name="tag" placeholder="Tag (optional)" />
                        <Button type="submit" className="w-full">
                          Add Todo
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {unscheduledTodos.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <Circle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No unscheduled todos</p>
                      <p className="text-sm">Add todos and drag them to time blocks to schedule</p>
                    </div>
                  ) : (
                    unscheduledTodos
                      .sort((a, b) => {
                        const priorityOrder = { high: 3, medium: 2, low: 1 }
                        return priorityOrder[b.priority] - priorityOrder[a.priority]
                      })
                      .map((todo) => (
                        <div
                          key={todo.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, todo)}
                          className={`p-3 rounded-lg border-2 cursor-move transition-all hover:shadow-md ${getPriorityColor(todo.priority)} hover:scale-[1.02] ${
                            todo.assignedToGoal ? "ring-2 ring-blue-200" : ""
                          }`}
                          style={{ borderLeftColor: todo.color, borderLeftWidth: "4px" }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{todo.title}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {todo.duration}min
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {todo.tag}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    todo.priority === "high"
                                      ? "text-red-600"
                                      : todo.priority === "medium"
                                        ? "text-yellow-600"
                                        : "text-green-600"
                                  }`}
                                >
                                  {todo.priority}
                                </Badge>
                                {todo.assignedToGoal && (
                                  <Badge variant="secondary" className="text-xs">
                                    📋 Goal
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeUnscheduledTodo(todo.id)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
                {unscheduledTodos.length > 0 && (
                  <div className="mt-4 p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 text-center">
                      💡 Drag todos to goals to create subtasks, or to time blocks to schedule them
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current Session & Settings */}
            <Card className="lg:col-span-2 border-l-4 border-l-indigo-500 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50">
                <CardTitle className="flex items-center gap-2 text-indigo-700">
                  <Timer className="w-5 h-5" />
                  Current Session - Time Remaining
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-mono font-bold">{formatTime(sessionTime)}</div>
                    {activeTask ? (
                      <div className="mt-2">
                        <Badge style={{ backgroundColor: activeTask.color }} className="text-white">
                          {activeTask.title}
                        </Badge>
                        <p className="text-sm text-gray-600 mt-1">Duration: {activeTask.duration} minutes</p>
                        {activeTask.fromCalendar && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            📅 From Calendar
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 mt-2">No active task</p>
                    )}
                  </div>
                  <div className="flex justify-center gap-2">
                    {activeTask && (
                      <>
                        <Button
                          onClick={() => setIsRunning(!isRunning)}
                          variant={isRunning ? "secondary" : "default"}
                        >
                          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {isRunning ? "Pause" : "Start"}
                        </Button>
                        <Button onClick={() => completeTask(activeTask.id)} variant="outline">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Complete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-teal-500 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50">
                <CardTitle className="flex items-center gap-2 text-teal-700">
                  <BarChart3 className="w-5 h-5" />
                  Progress Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Tasks Completed</span>
                    <span>
                      {getCompletedTasksCount()}/{getTotalTasksCount()}
                    </span>
                  </div>
                  <Progress value={getProductivityScore()} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Goals Completed</span>
                    <span>
                      {dailyGoals.filter((g) => g.completed).length}/{dailyGoals.length}
                    </span>
                  </div>
                  <Progress
                    value={
                      dailyGoals.length > 0
                        ? (dailyGoals.filter((g) => g.completed).length / dailyGoals.length) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm text-gray-600">Productivity Score</p>
                  <p className="text-2xl font-bold text-blue-600">{getProductivityScore()}%</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Time Block Settings */}
          <Card className="border-l-4 border-l-violet-500 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50">
              <CardTitle className="flex items-center gap-2 text-violet-700">
                <Settings className="w-5 h-5" />
                Time Block Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Default Block Duration:</label>
                <Select
                  value={defaultBlockDuration.toString()}
                  onValueChange={(value) => setDefaultBlockDuration(Number.parseInt(value))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{renderDurationOptions()}</SelectContent>
                </Select>
                <Badge variant="outline">{Math.floor(60 / defaultBlockDuration)} blocks/hour</Badge>

                <Dialog open={managePresetsDialog} onOpenChange={setManagePresetsDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-1" />
                      Manage Presets
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Manage Duration Presets</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Add New Preset</label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Minutes (1-120)"
                            value={newPresetValue}
                            onChange={(e) => setNewPresetValue(e.target.value)}
                            min="1"
                            max="120"
                          />
                          <Button
                            onClick={() => {
                              const duration = Number.parseInt(newPresetValue)
                              if (duration && duration > 0 && duration <= 120) {
                                addDurationPreset(duration)
                                setNewPresetValue("")
                              }
                            }}
                            disabled={!newPresetValue || isNaN(Number.parseInt(newPresetValue))}
                          >
                            Add
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Current Presets</label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                          {getAllDurations().map((duration) => (
                            <div key={duration} className="flex items-center justify-between p-2 border rounded">
                              <span className="text-sm">
                                {duration} min
                                {getDefaultDurations().includes(duration) && (
                                  <Badge variant="secondary" className="text-xs ml-1">
                                    default
                                  </Badge>
                                )}
                              </span>
                              {!getDefaultDurations().includes(duration) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeDurationPreset(duration)}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                >
                                  ×
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="text-xs text-gray-500">
                        💡 Custom presets will appear in all duration dropdowns across the app
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* 24 Hour Time Blocks */}
          <Card className="border-l-4 border-l-emerald-500 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50">
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <Clock className="w-5 h-5" />
                24 Hour Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {timeBlocks.map((block) => {
                  const status = getBlockStatus(block.hour)
                  const remainingTime = getBlockRemainingTime(block)
                  const canQuickFill = remainingTime >= defaultBlockDuration
                  const isCurrentHour = status === "present"
                  const hourProgress = isCurrentHour ? getCurrentHourProgress() : 0
                  const remainingMinutesInHour = isCurrentHour ? getRemainingMinutesInCurrentHour() : 60

                  return (
                    <div
                      key={block.id}
                      className={`relative p-4 border rounded-lg transition-all hover:shadow-md ${getBlockColor(status)} ${
                        draggedTodo
                          ? canScheduleTask(block, draggedTodo.duration)
                            ? "border-dashed border-2 border-blue-400"
                            : "border-dashed border-2 border-red-400 bg-red-50"
                          : ""
                      }`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, block.hour)}
                    >
                      {/* Time Progress Overlay for Current Hour */}
                      {isCurrentHour && (
                        <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                          <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-600/30 to-teal-600/30 backdrop-blur-[1px] transition-all duration-1000"
                            style={{ width: `${hourProgress}%` }}
                          />
                        </div>
                      )}

                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className={`font-semibold ${isCurrentHour ? "text-white" : ""}`}>
                            {block.hour.toString().padStart(2, "0")}:00 -{" "}
                            {((block.hour + 1) % 24).toString().padStart(2, "0")}:00
                          </h3>
                          <div className="flex items-center gap-2">
                            {status === "present" && (
                              <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/30 animate-pulse">
                                NOW
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                isCurrentHour 
                                  ? "text-white border-white/30 bg-white/10"
                                  : getBlockTotalTime(block) > 60
                                    ? "text-red-600 border-red-300"
                                    : getBlockTotalTime(block) > 45
                                      ? "text-yellow-600 border-yellow-300"
                                      : "text-gray-600"
                              }`}
                            >
                              {getBlockTotalTime(block)}/60min
                            </Badge>
                          </div>
                        </div>

                        {/* Current Hour Time Info */}
                        {isCurrentHour && (
                          <div className="mb-3 p-2 bg-white/20 rounded-lg backdrop-blur-sm border border-white/30">
                            <div className="flex justify-between items-center text-xs text-white font-medium">
                              <span>⏱️ Elapsed: {getCurrentMinute()} min</span>
                              <span>⚡ Remaining: {remainingMinutesInHour} min</span>
                            </div>
                            <div className="mt-1 h-2 bg-white/20 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-yellow-300 to-orange-300 transition-all duration-1000 shadow-sm"
                                style={{ width: `${hourProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="mb-3">
                          <Progress
                            value={(getBlockTotalTime(block) / 60) * 100}
                            className={`h-1 ${
                              isCurrentHour
                                ? "[&>div]:bg-white/60"
                                : getBlockTotalTime(block) > 60
                                  ? "[&>div]:bg-red-500"
                                  : getBlockTotalTime(block) > 45
                                    ? "[&>div]:bg-yellow-500"
                                    : "[&>div]:bg-green-500"
                            }`}
                          />
                        </div>

                        {canQuickFill && (
                          <div className="mb-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => quickFillBlock(block.hour)}
                              className={`w-full h-6 text-xs ${
                                isCurrentHour 
                                  ? "border-white/30 text-white hover:bg-white/10"
                                  : ""
                              }`}
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              Quick Fill ({Math.floor(remainingTime / defaultBlockDuration)} × {defaultBlockDuration}
                              min)
                            </Button>
                          </div>
                        )}

                        <div className="space-y-2 min-h-[100px] relative">
                          {draggedTodo && (
                            <div
                              className={`absolute inset-0 border-2 border-dashed rounded flex items-center justify-center opacity-75 ${
                                canScheduleTask(block, draggedTodo.duration)
                                  ? "bg-blue-50 border-blue-300"
                                  : "bg-red-50 border-red-300"
                              }`}
                            >
                              <p
                                className={`text-sm font-medium ${
                                  canScheduleTask(block, draggedTodo.duration) ? "text-blue-600" : "text-red-600"
                                }`}
                              >
                                {canScheduleTask(block, draggedTodo.duration)
                                  ? "Drop here to schedule"
                                  : `Not enough time (${getBlockRemainingTime(block)}min left)`}
                              </p>
                            </div>
                          )}

                          {getBlockTotalTime(block) > 60 && (
                            <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded">
                              Overbooked by {getBlockTotalTime(block) - 60}min
                            </div>
                          )}
                          
                          {block.tasks.length === 0 && isCurrentHour && (
                            <div className="flex items-center justify-center h-full text-white/70 text-sm">
                              Click to add tasks
                            </div>
                          )}

                          {block.tasks.map((task) => (
                            <div
                              key={task.id}
                              className={`p-2 rounded text-sm transition-all hover:shadow-sm group relative ${
                                task.completed ? "opacity-60" : ""
                              }`}
                              style={{ 
                                backgroundColor: isCurrentHour ? "rgba(255,255,255,0.15)" : task.color + "20", 
                                borderLeft: `3px solid ${task.color}` 
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`cursor-pointer flex-1 ${
                                    task.completed ? "line-through" : ""
                                  } ${isCurrentHour ? "text-white" : ""}`}
                                  onClick={() => !task.completed && startTask(task)}
                                >
                                  {task.title}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`h-6 w-6 p-0 hover:text-blue-500 ${
                                      isCurrentHour ? "text-white/70" : "text-gray-400"
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openEditTask(task, block.hour)
                                    }}
                                  >
                                    <Settings className="w-3 h-3" />
                                  </Button>
                                  {task.completed && <CheckCircle className="w-4 h-4 text-green-500" />}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    isCurrentHour ? "text-white/80 border-white/30" : ""
                                  }`}
                                >
                                  {task.duration}min
                                </Badge>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    isCurrentHour ? "text-white/80 border-white/30" : ""
                                  }`}
                                >
                                  {task.tag}
                                </Badge>
                                {task.fromCalendar && (
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-xs ${
                                      isCurrentHour ? "bg-white/20 text-white border-white/30" : ""
                                    }`}
                                  >
                                    📅
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}

                          <Dialog
                            open={newTaskDialog && selectedHour === block.hour}
                            onOpenChange={(open) => {
                              setNewTaskDialog(open)
                              if (open) setSelectedHour(block.hour)
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                className={`w-full h-8 text-xs border-2 border-dashed hover:border-gray-400 ${
                                  isCurrentHour 
                                    ? "border-white/30 text-white/70 hover:border-white/50 hover:text-white"
                                    : "border-gray-300 text-gray-500"
                                }`}
                                onClick={() => setSelectedHour(block.hour)}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add Task
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Add Task for {block.hour.toString().padStart(2, "0")}:00</DialogTitle>
                              </DialogHeader>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  try {
                                    const formData = new FormData(e.currentTarget)
                                    const title = formData.get("title") as string
                                    const duration = Number.parseInt(formData.get("duration") as string)
                                    const color = formData.get("color") as string
                                    const tag = formData.get("tag") as string

                                    if (title.trim() && !isNaN(duration)) {
                                      addTask(selectedHour, {
                                        title: title.trim(),
                                        duration,
                                        color,
                                        tag: tag.trim() || "General",
                                        completed: false,
                                      })
                                      setNewTaskDialog(false)
                                      e.currentTarget.reset()
                                    }
                                  } catch (error) {
                                    console.error("Error adding task:", error)
                                  }
                                }}
                              >
                                <div className="space-y-4">
                                  <Input name="title" placeholder="Task title..." required />
                                  <Select name="duration" defaultValue={defaultBlockDuration.toString()}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Duration" />
                                    </SelectTrigger>
                                    <SelectContent>{renderDurationOptions()}</SelectContent>
                                  </Select>
                                  <Select name="color" defaultValue="#3b82f6">
                                    <SelectTrigger>
                                      <SelectValue placeholder="Color" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="#3b82f6">Blue</SelectItem>
                                      <SelectItem value="#10b981">Green</SelectItem>
                                      <SelectItem value="#f59e0b">Yellow</SelectItem>
                                      <SelectItem value="#ef4444">Red</SelectItem>
                                      <SelectItem value="#8b5cf6">Purple</SelectItem>
                                      <SelectItem value="#06b6d4">Cyan</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input name="tag" placeholder="Tag (optional)" />
                                  <Button type="submit" className="w-full">
                                    Add Task
                                  </Button>
                                </div>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly View */}
        <TabsContent value="weekly">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Weekly Calendar
              </CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedDate(new Date())
                  setEditingEvent(null)
                  setNewEventDialog(true)
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Event
              </Button>
            </CardHeader>
            <CardContent>{renderWeeklyCalendar()}</CardContent>
          </Card>
        </TabsContent>

        {/* Monthly View */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Monthly Calendar
              </CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedDate(new Date())
                  setEditingEvent(null)
                  setNewEventDialog(true)
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Event
              </Button>
            </CardHeader>
            <CardContent>{renderMonthlyCalendar()}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Event Dialog */}
      <Dialog open={newEventDialog} onOpenChange={setNewEventDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit Event" : "Add New Event"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              try {
                const formData = new FormData(e.currentTarget)
                const title = formData.get("title") as string
                const description = formData.get("description") as string
                const startTime = new Date(formData.get("startTime") as string)
                const endTime = new Date(formData.get("endTime") as string)
                const type = formData.get("type") as CalendarEvent["type"]
                const location = formData.get("location") as string
                const color = getEventTypeColor(type)

                if (title.trim() && startTime && endTime && endTime > startTime) {
                  const eventData = {
                    title: title.trim(),
                    description: description.trim(),
                    startTime,
                    endTime,
                    type,
                    location: location.trim(),
                    color,
                    attendees: [],
                  }

                  if (editingEvent) {
                    updateCalendarEvent(editingEvent.id, eventData)
                  } else {
                    addCalendarEvent(eventData)
                  }

                  setNewEventDialog(false)
                  setEditingEvent(null)
                  e.currentTarget.reset()
                }
              } catch (error) {
                console.error("Error saving event:", error)
              }
            }}
          >
            <div className="space-y-4">
              <Input
                name="title"
                placeholder="Event title..."
                defaultValue={editingEvent?.title || ""}
                required
              />
              <Input
                name="description"
                placeholder="Description (optional)"
                defaultValue={editingEvent?.description || ""}
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">Start Time</label>
                  <Input
                    name="startTime"
                    type="datetime-local"
                    defaultValue={
                      editingEvent
                        ? new Date(editingEvent.startTime.getTime() - editingEvent.startTime.getTimezoneOffset() * 60000)
                            .toISOString()
                            .slice(0, 16)
                        : selectedDate
                          ? new Date(selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000)
                              .toISOString()
                              .slice(0, 16)
                          : ""
                    }
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Time</label>
                  <Input
                    name="endTime"
                    type="datetime-local"
                    defaultValue={
                      editingEvent
                        ? new Date(editingEvent.endTime.getTime() - editingEvent.endTime.getTimezoneOffset() * 60000)
                            .toISOString()
                            .slice(0, 16)
                        : selectedDate
                          ? new Date(selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000 + 3600000)
                              .toISOString()
                              .slice(0, 16)
                          : ""
                    }
                    required
                  />
                </div>
              </div>
              <Select name="type" defaultValue={editingEvent?.type || "meeting"}>
                <SelectTrigger>
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="appointment">Appointment</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input
                name="location"
                placeholder="Location (optional)"
                defaultValue={editingEvent?.location || ""}
              />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingEvent ? "Update Event" : "Add Event"}
                </Button>
                {editingEvent && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      deleteCalendarEvent(editingEvent.id)
                      setNewEventDialog(false)
                      setEditingEvent(null)
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Intervention Dialog */}
        <Dialog open={showInterventionDialog} onOpenChange={setShowInterventionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Time's Up!</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Your {activeTask?.duration}-minute session for "{activeTask?.title}" is complete.
              </p>
              <p>How did it go?</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (activeTask) completeTask(activeTask.id)
                    setShowInterventionDialog(false)
                  }}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Completed
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (activeTask) {
                      setSessionTime(activeTask.duration * 60)
                    }
                    setIsRunning(true)
                    setShowInterventionDialog(false)
                  }}
                  className="flex-1"
                >
                  <Play className="w-4 h-4 mr-1" />
                  Continue Working
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Task Dialog */}
        <Dialog open={editTaskDialog} onOpenChange={setEditTaskDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
            </DialogHeader>
            {editingTask && editingTaskHour !== null && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  try {
                    const formData = new FormData(e.currentTarget)
                    const title = formData.get("title") as string
                    const duration = Number.parseInt(formData.get("duration") as string)
                    const color = formData.get("color") as string
                    const tag = formData.get("tag") as string

                    if (title.trim() && !isNaN(duration)) {
                      const targetBlock = timeBlocks.find((block) => block.hour === editingTaskHour)
                      if (targetBlock) {
                        const otherTasksTime = targetBlock.tasks
                          .filter((task) => task.id !== editingTask.id)
                          .reduce((total, task) => total + task.duration, 0)

                        if (otherTasksTime + duration > 60) {
                          alert(`Cannot update task: Only ${60 - otherTasksTime} minutes available in this hour block.`)
                          return
                        }
                      }

                      updateTask(editingTaskHour, editingTask.id, {
                        title: title.trim(),
                        duration,
                        color,
                        tag: tag.trim() || "General",
                      })
                      setEditTaskDialog(false)
                      setEditingTask(null)
                      setEditingTaskHour(null)
                    }
                  } catch (error) {
                    console.error("Error updating task:", error)
                  }
                }}
              >
                <div className="space-y-4">
                  <Input name="title" placeholder="Task title..." defaultValue={editingTask.title} required />
                  <Select name="duration" defaultValue={editingTask.duration.toString()}>
                    <SelectTrigger>
                      <SelectValue placeholder="Duration" />
                    </SelectTrigger>
                    <SelectContent>{renderDurationOptions()}</SelectContent>
                  </Select>
                  <Select name="color" defaultValue={editingTask.color}>
                    <SelectTrigger>
                      <SelectValue placeholder="Color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="#3b82f6">Blue</SelectItem>
                      <SelectItem value="#10b981">Green</SelectItem>
                      <SelectItem value="#f59e0b">Yellow</SelectItem>
                      <SelectItem value="#ef4444">Red</SelectItem>
                      <SelectItem value="#8b5cf6">Purple</SelectItem>
                      <SelectItem value="#06b6d4">Cyan</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input name="tag" placeholder="Tag (optional)" defaultValue={editingTask.tag} />
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      Update Task
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        if (editingTaskHour !== null && editingTask) {
                          deleteTask(editingTaskHour, editingTask.id)
                          setEditTaskDialog(false)
                          setEditingTask(null)
                          setEditingTaskHour(null)
                        }
                      }}
                      className="flex-1"
                    >
                      Delete Task
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
