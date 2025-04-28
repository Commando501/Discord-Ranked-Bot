import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format file size to human readable format
 * @param bytes File size in bytes
 * @returns Formatted size (e.g. "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date to human readable format
 * @param date Date object
 * @returns Formatted date (e.g. "Apr 28, 2023, 2:30 PM")
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { 
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}