export type Role = "student" | "admin" | "staff"
export type ReportStatus = "Submitted" | "Under Review" | "Approved" | "Assigned" | "In Progress" | "Resolved" | "Closed" | "Reopened" | "Rejected"
export type Priority = "Low" | "Medium" | "High" | "Urgent"
export type ReportCategory = "HVAC" | "Electrical" | "Plumbing" | "IT & AV" | "Furniture" | "Safety" | "Cleaning" | "Other"
export type MaintenanceDepartment = typeof DEPARTMENT_OPTIONS[number]

export type ReportUpdate = {
  id: string
  createdAt: string
  actor: string
  title: string
  message: string
}

export type CampusReport = {
  id: string
  title: string
  description: string
  category: ReportCategory
  building: string
  room: string
  buildingId?: string
  floor?: string | null
  roomNumber?: string | null
  additionalDetails?: string | null
  status: ReportStatus
  priority: Priority
  reporterName: string
  reporterEmail: string
  reporterProgram: string
  assignedTo: string | null
  assignedStaffId?: string | null
  departmentId?: string | null
  department?: MaintenanceDepartment | null
  createdAt: string
  updatedAt: string
  images: string[]
  updates: ReportUpdate[]
  version?: string
  dbId?: string
  aiAnalysis?: {
    id?: string
    problemSummary: string
    detectedObject: string
    suggestedCategory: string
    suggestedPriority: string
    recommendedDepartment: string
    generatedDescription: string
    confidence: number
    requiresHumanReview: boolean
    reviewStatus: string
    aiProvider: string
    modelName: string
  } | null
}

export type DemoProfile = {
  name: string
  email: string
  department: string
  phone: string
  roleLabel: string
}

export type CampusNotification = {
  id: string
  title: string
  message: string
  createdAt: string
  read: boolean
  reportId?: string
  type: "status" | "message" | "system"
}

export const CATEGORY_OPTIONS: ReportCategory[] = [
  "HVAC",
  "Electrical",
  "Plumbing",
  "IT & AV",
  "Furniture",
  "Safety",
  "Cleaning",
  "Other",
]

export const BUILDING_OPTIONS = [
  "North Science Center",
  "Morrow Library",
  "Student Union",
  "West Residence Hall",
  "Fine Arts Building",
  "Athletics Complex",
]

export const DEPARTMENT_OPTIONS = [
  "Facilities Services",
  "Electrical Services",
  "Plumbing Services",
  "Campus IT",
  "Campus Safety",
  "Housekeeping",
] as const

export const DEPARTMENT_BY_CATEGORY: Record<ReportCategory, MaintenanceDepartment> = {
  HVAC: "Facilities Services",
  Electrical: "Electrical Services",
  Plumbing: "Plumbing Services",
  "IT & AV": "Campus IT",
  Furniture: "Facilities Services",
  Safety: "Campus Safety",
  Cleaning: "Housekeeping",
  Other: "Facilities Services",
}

export const INITIAL_PROFILES: Record<Role, DemoProfile> = {
  student: {
    name: "Aisha Patel",
    email: "aisha.patel@northfield.edu",
    department: "Environmental Science · Class of 2027",
    phone: "(555) 014-2841",
    roleLabel: "Student",
  },
  admin: {
    name: "Dana Brooks",
    email: "dana.brooks@northfield.edu",
    department: "Campus Operations",
    phone: "(555) 014-3200",
    roleLabel: "Administrator",
  },
  staff: {
    name: "Jordan Kim",
    email: "jordan.kim@northfield.edu",
    department: "Facilities Services",
    phone: "(555) 014-1882",
    roleLabel: "Facilities staff",
  },
}

const sampleUpdates = (items: Omit<ReportUpdate, "id">[]): ReportUpdate[] =>
  items.map((item, index) => ({ ...item, id: `update-${index + 1}` }))

export const DEMO_REPORTS: CampusReport[] = [
  {
    id: "RPT-1048",
    title: "Air conditioning unit is leaking in lecture hall",
    description:
      "There is water dripping from the wall-mounted air conditioner in lecture hall A101. The floor is starting to get slippery near the first row of seats.",
    category: "HVAC",
    building: "North Science Center",
    room: "A101",
    status: "Under Review",
    priority: "High",
    reporterName: "Aisha Patel",
    reporterEmail: "aisha.patel@northfield.edu",
    reporterProgram: "Environmental Science",
    assignedTo: "Jordan Kim",
    createdAt: "2026-10-28T08:42:00.000Z",
    updatedAt: "2026-10-28T09:20:00.000Z",
    images: ["/images/campus/ac-leak.png"],
    updates: sampleUpdates([
      {
        createdAt: "2026-10-28T08:42:00.000Z",
        actor: "Aisha Patel",
        title: "Report submitted",
        message: "Your report was received by Campus Operations.",
      },
      {
        createdAt: "2026-10-28T09:20:00.000Z",
        actor: "Dana Brooks",
        title: "Initial review complete",
        message: "A facilities technician has been assigned to assess the leak.",
      },
    ]),
  },
  {
    id: "RPT-1047",
    title: "Projector image flickers during lectures",
    description:
      "The projector in room B204 flickers every few minutes and sometimes loses its connection to the lectern computer.",
    category: "IT & AV",
    building: "North Science Center",
    room: "B204",
    status: "In Progress",
    priority: "Medium",
    reporterName: "Marco Ruiz",
    reporterEmail: "marco.ruiz@northfield.edu",
    reporterProgram: "Biology",
    assignedTo: "Jordan Kim",
    createdAt: "2026-10-27T13:15:00.000Z",
    updatedAt: "2026-10-28T07:30:00.000Z",
    images: ["/images/campus/projector-fault.png"],
    updates: sampleUpdates([
      {
        createdAt: "2026-10-27T13:15:00.000Z",
        actor: "Marco Ruiz",
        title: "Report submitted",
        message: "Your report was received by Campus Operations.",
      },
      {
        createdAt: "2026-10-28T07:30:00.000Z",
        actor: "Jordan Kim",
        title: "Work started",
        message: "The AV team is checking the projector connection and cable.",
      },
    ]),
  },
  {
    id: "RPT-1046",
    title: "Loose handrail on the second-floor stairwell",
    description:
      "The handrail on the east stairwell feels loose when used. It is on the second floor between the library and the student center.",
    category: "Safety",
    building: "Student Union",
    room: "East stairwell · 2nd floor",
    status: "Submitted",
    priority: "High",
    reporterName: "Aisha Patel",
    reporterEmail: "aisha.patel@northfield.edu",
    reporterProgram: "Environmental Science",
    assignedTo: null,
    createdAt: "2026-10-26T15:06:00.000Z",
    updatedAt: "2026-10-26T15:06:00.000Z",
    images: [],
    updates: sampleUpdates([
      {
        createdAt: "2026-10-26T15:06:00.000Z",
        actor: "Aisha Patel",
        title: "Report submitted",
        message: "Your report was received by Campus Operations.",
      },
    ]),
  },
  {
    id: "RPT-1045",
    title: "Faucet keeps running in the library restroom",
    description:
      "The sink faucet in the first-floor west restroom continues to run after the handle is turned off.",
    category: "Plumbing",
    building: "Morrow Library",
    room: "1st floor · west restroom",
    status: "Resolved",
    priority: "Low",
    reporterName: "Aisha Patel",
    reporterEmail: "aisha.patel@northfield.edu",
    reporterProgram: "Environmental Science",
    assignedTo: "Jordan Kim",
    createdAt: "2026-10-24T10:18:00.000Z",
    updatedAt: "2026-10-25T12:00:00.000Z",
    images: [],
    updates: sampleUpdates([
      {
        createdAt: "2026-10-24T10:18:00.000Z",
        actor: "Aisha Patel",
        title: "Report submitted",
        message: "Your report was received by Campus Operations.",
      },
      {
        createdAt: "2026-10-25T12:00:00.000Z",
        actor: "Jordan Kim",
        title: "Issue resolved",
        message: "The faucet cartridge was replaced and tested.",
      },
    ]),
  },
  {
    id: "RPT-1044",
    title: "Several seats are damaged in the auditorium",
    description:
      "Two seats in the center section have loose backs and should be checked before the next campus event.",
    category: "Furniture",
    building: "Fine Arts Building",
    room: "Auditorium · center section",
    status: "In Progress",
    priority: "Medium",
    reporterName: "Aisha Patel",
    reporterEmail: "aisha.patel@northfield.edu",
    reporterProgram: "Environmental Science",
    assignedTo: "Jordan Kim",
    createdAt: "2026-10-22T11:24:00.000Z",
    updatedAt: "2026-10-27T09:10:00.000Z",
    images: [],
    updates: sampleUpdates([
      {
        createdAt: "2026-10-22T11:24:00.000Z",
        actor: "Aisha Patel",
        title: "Report submitted",
        message: "Your report was received by Campus Operations.",
      },
      {
        createdAt: "2026-10-27T09:10:00.000Z",
        actor: "Jordan Kim",
        title: "Parts requested",
        message: "Replacement hardware has been requested for the seat backs.",
      },
    ]),
  },
  {
    id: "RPT-1043",
    title: "Elevator call button is unresponsive",
    description:
      "The down button for the east elevator on the ground floor does not light up or call the elevator consistently.",
    category: "Electrical",
    building: "West Residence Hall",
    room: "Ground floor · east elevator",
    status: "Submitted",
    priority: "Urgent",
    reporterName: "Nia Williams",
    reporterEmail: "nia.williams@northfield.edu",
    reporterProgram: "Psychology",
    assignedTo: null,
    createdAt: "2026-10-28T07:55:00.000Z",
    updatedAt: "2026-10-28T07:55:00.000Z",
    images: [],
    updates: sampleUpdates([
      {
        createdAt: "2026-10-28T07:55:00.000Z",
        actor: "Nia Williams",
        title: "Report submitted",
        message: "Your report was received by Campus Operations.",
      },
    ]),
  },
  {
    id: "RPT-1042",
    title: "Study lounge light flickers intermittently",
    description:
      "The ceiling light above the shared study table flickers and makes it difficult to work in the evening.",
    category: "Electrical",
    building: "Morrow Library",
    room: "3rd floor · west study lounge",
    status: "Under Review",
    priority: "Low",
    reporterName: "Aisha Patel",
    reporterEmail: "aisha.patel@northfield.edu",
    reporterProgram: "Environmental Science",
    assignedTo: null,
    createdAt: "2026-10-20T18:05:00.000Z",
    updatedAt: "2026-10-21T09:40:00.000Z",
    images: [],
    updates: sampleUpdates([
      {
        createdAt: "2026-10-20T18:05:00.000Z",
        actor: "Aisha Patel",
        title: "Report submitted",
        message: "Your report was received by Campus Operations.",
      },
      {
        createdAt: "2026-10-21T09:40:00.000Z",
        actor: "Dana Brooks",
        title: "Initial review complete",
        message: "The electrical team will inspect the fixture this week.",
      },
    ]),
  },
  {
    id: "RPT-1041",
    title: "Wi-Fi signal drops in the north study area",
    description:
      "The campus network drops repeatedly in the north wing of the library, especially near the group study rooms.",
    category: "IT & AV",
    building: "Morrow Library",
    room: "2nd floor · north wing",
    status: "Resolved",
    priority: "Medium",
    reporterName: "Eli Thompson",
    reporterEmail: "eli.thompson@northfield.edu",
    reporterProgram: "Computer Science",
    assignedTo: "Jordan Kim",
    createdAt: "2026-10-18T14:36:00.000Z",
    updatedAt: "2026-10-20T16:25:00.000Z",
    images: [],
    updates: sampleUpdates([
      {
        createdAt: "2026-10-18T14:36:00.000Z",
        actor: "Eli Thompson",
        title: "Report submitted",
        message: "Your report was received by Campus Operations.",
      },
      {
        createdAt: "2026-10-20T16:25:00.000Z",
        actor: "Jordan Kim",
        title: "Issue resolved",
        message: "A wireless access point was restarted and coverage was verified.",
      },
    ]),
  },
]

export const INITIAL_NOTIFICATIONS: CampusNotification[] = [
  {
    id: "notification-1",
    title: "Your report is under review",
    message: "Campus Operations assigned a technician to RPT-1048.",
    createdAt: "2026-10-28T09:20:00.000Z",
    read: false,
    reportId: "RPT-1048",
    type: "status",
  },
  {
    id: "notification-2",
    title: "A report was resolved",
    message: "The running faucet in Morrow Library has been repaired.",
    createdAt: "2026-10-25T12:00:00.000Z",
    read: false,
    reportId: "RPT-1045",
    type: "status",
  },
  {
    id: "notification-3",
    title: "Welcome to CampusFix",
    message: "You can follow requests and updates from your notifications page.",
    createdAt: "2026-10-20T08:00:00.000Z",
    read: true,
    type: "system",
  },
]
