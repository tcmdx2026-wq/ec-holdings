import type { Attendance, DailyAttendance, Note, Task } from "@/lib/types";
import attendanceJson from "./attendance.json";
import notesJson from "./notes.json";
import tasksJson from "./tasks.json";

export const seedTasks = tasksJson as Task[];
export const seedNotes = notesJson as Note[];

const att = attendanceJson as { records: Attendance[]; daily: DailyAttendance[] };
export const seedAttendance = att.records;
export const seedDaily = att.daily;
