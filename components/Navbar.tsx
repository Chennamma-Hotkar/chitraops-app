"use client";
import { Search, Bell } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-gradient-to-b from-black/90 to-transparent px-12 py-4 flex justify-between items-center transition-all">
      <div className="flex items-center space-x-8">
        <h1 className="text-red-600 text-3xl font-extrabold tracking-tighter uppercase">ChitraOps</h1>
        <div className="hidden md:flex space-x-5 text-sm font-medium text-gray-300">
          <span className="hover:text-white cursor-pointer">Home</span>
          <span className="hover:text-white cursor-pointer">Compliance</span>
          <span className="hover:text-white cursor-pointer">My Training</span>
        </div>
      </div>
      <div className="flex items-center space-x-6 text-white">
        <Search className="w-5 h-5 cursor-pointer hover:scale-110 transition" />
        <Bell className="w-5 h-5 cursor-pointer hover:scale-110 transition" />
        <div className="w-8 h-8 bg-blue-600 rounded cursor-pointer" />
      </div>
    </nav>
  );
}