
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  UserCheck,
  Users,
} from "lucide-react"

// Illustrative dashboard figures used by DashboardPreview; these are sample values, not live school data.
export const metrics = [
  { label: "Total Students", value: "1,240" },
  { label: "Active Teachers", value: "45" },
  { label: "Classes", value: "24" },
]

// Sample activity messages shown in the dashboard preview.
export const activities = [
  "Attendance recorded for SS3A",
  "New student record created for John Doe",
]

// Marketing feature content. Icon components and asset paths let the page render matching visuals.
export const features = [
  {
    title: "Student Records",
    description: "Keep student profiles, records, and notes in one place.",
    Icon: Users,
    desktopAsset: "/assets/26bf3.svg",
    mobileAsset: "/assets/a0b22.svg",
  },
  {
    title: "Attendance",
    description:
      "Record attendance and keep daily attendance records organized.",
    Icon: CalendarDays,
    desktopAsset: "/assets/5a2ee.svg",
    mobileAsset: "/assets/d6db3.svg",
  },
  {
    title: "Teacher Management",
    description: "Assign classes and manage teacher records.",
    Icon: UserCheck,
    desktopAsset: "/assets/99232.svg",
    mobileAsset: "/assets/6945e.svg",
  },
  {
    title: "Classes",
    description: "Organize classrooms and class groups.",
    Icon: BookOpen,
    desktopAsset: "/assets/4c9c0.svg",
    mobileAsset: "/assets/74e17.svg",
  },
  {
    title: "Results",
    description: "Record results and keep report cards organized.",
    Icon: ClipboardList,
    desktopAsset: "/assets/cbcf9.svg",
    mobileAsset: "/assets/285b6.svg",
  },
]

// Copy and benefit lists for the administrator and teacher audience cards.
export const roles = [
  {
    title: "For school administrators",
    description:
      "Organize student and teacher records and manage classes across your schools, with daily tasks kept in one place.",
    mobileDescription:
      "Keep student and teacher records organized, manage classes across multiple schools, and review daily activity in one place.",
    benefits: [
      "Organize student records, notes, and profiles.",
      "Manage teacher records and class assignments.",
      "Review classes, attendance, and recent activity.",
    ],
  },
  {
    title: "For teachers",
    description:
      "Record attendance and results for your classes quickly, so you can focus on teaching and student progress.",
    benefits: [
      "Record attendance for your classes.",
      "Record results and keep report cards organized.",
      "Work with classes and student records assigned to you.",
    ],
  },
]

// Ordered descriptions used by the How It Works section.
export const steps = [
  {
    title: "Set Up Your School",
    description: "Create your school account and invite administrators.",
  },
  {
    title: "Add Records",
    description: "Add student, teacher, class, and results records.",
  },
  {
    title: "Manage Daily Tasks",
    description:
      "Start managing daily attendance, records, classes, and results.",
  },
]

