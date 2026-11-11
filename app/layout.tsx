import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'WAP X 빼빼로데이', description: '빼빼로 삼행시를 작성하고 작품에 투표하세요.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ko"><body>{children}</body></html>; }
