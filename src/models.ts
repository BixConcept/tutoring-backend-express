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
  hasSignal: boolean;
  hasWhatsapp: boolean;
  discordUser: string;
  hasDiscord: boolean;
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

export interface NotificationRequest {
  id: number;
  email: string;
  grade: number;
  subjectId: number;
}

export interface ApiRequest {
  id: number;
  method: string;
  authLevel: AuthLevel;
  path: string;
  time: Date;
  userAgent?: string;
  frontendPath?: string;
}
