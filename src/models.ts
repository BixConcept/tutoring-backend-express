export interface User {
  id: number;
  name: string;
  email: string;
  phoneNumber?: string;
  authLevel: AuthLevel;
  grade: number;
  createdAt: Date;
  updatedAt: Date;
  offers: Offer[];
}

export interface Offer {
  id: number;
  userId: number;
  subjectId: number;
  subjectName: string;
  maxGrade: number;
  createdAt: Date;
}

export enum AuthLevel {
  Unverified = 0,
  Verified = 1,
  Admin = 2,
}

export interface Subject {
  id: number;
  name: string;
}
