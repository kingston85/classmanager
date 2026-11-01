export type Status = 'P' | 'A' | 'L' | 'E'; // Present, Absent, Late, Excused

export interface Student {
  id: string;
  studentNo: string;
  name: string;
  email?: string;
  phone?: string;
  pin: string; // 6-digit code the student uses to open their share file
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  topic: string;
  records: Record<string, Status>; // studentId -> status
}

export interface Assessment {
  id: string;
  name: string;
  category: string;
  max: number;
  weight: number; // percent of the final grade
  date?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  date: string;
  pinned: boolean;
}

export interface GradeBand {
  min: number;
  letter: string;
  points: number;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  section: string;
  credits: number;
  semester: string;
  room: string;
  lecturer: string;
  days: number[]; // 0 = Sunday ... 6 = Saturday
  time: string;
  startDate: string;
  weeks: number;
  capacity: number;
  attendanceWeight: number; // percent of the final grade (0 = not graded)
  riskAttendance: number; // flag below this attendance %
  riskStanding: number; // flag below this standing %
  scale: GradeBand[];
  students: Student[];
  sessions: Session[];
  assessments: Assessment[];
  scores: Record<string, Record<string, number | null>>; // assessmentId -> studentId -> score
  announcements: Announcement[];
  createdAt: string;
}

export interface Workspace {
  version: 1;
  lecturerName: string;
  courses: Course[];
}

export interface ShareEntry {
  studentNo: string;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64 AES-GCM ciphertext of StudentView JSON
}

export interface ShareBundle {
  format: 'classmanager-share';
  v: 1;
  publishedAt: string;
  course: {
    code: string;
    title: string;
    section: string;
    semester: string;
    lecturer: string;
    room: string;
    time: string;
  };
  announcements: Announcement[];
  entries: ShareEntry[];
}

export interface StudentView {
  name: string;
  studentNo: string;
  attendance: { date: string; topic: string; status: Status | '' }[];
  attendancePct: number | null;
  assessments: {
    name: string;
    category: string;
    max: number;
    weight: number;
    score: number | null;
    date?: string;
  }[];
  standing: number | null;
  projected: number | null;
  letter: string;
  rank: number | null;
  classSize: number;
}
