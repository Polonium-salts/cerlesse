import React, { useState } from "react";
import { IOSWidget } from "../ui/IOSWidget.js";
import { QrCode, Smartphone, Copy, Check, ExternalLink } from "lucide-react";

interface MobileQRConnectWidgetProps {
  url?: string;
  query: string;
}

export const MobileQRConnectWidget: React.FC<MobileQRConnectWidgetProps> = ({
  url,
  query
}) => {
  const [copied, setCopied] = useState(false);
  const targetUrl = url || window.location.href;

  const handleCopy = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <IOSWidget
      id="widget-mobile-qr"
      title="移动端同步互联"
      subtitle="扫描二维码在手机端继续阅读"
      icon={<Smartphone className="w-4 h-4 text-blue-500" />}
      badge={
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
          <QrCode className="w-3 h-3 text-blue-500" />
          <span>即开即读</span>
        </span>
      }
      className="w-full h-full"
    >
      <div className="flex-1 flex flex-col items-center justify-between text-center space-y-3">
        {/* SVG QR Code Pattern like the QR in the user's reference image */}
        <div className="p-3 rounded-2xl bg-white dark:bg-white text-zinc-950 border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center justify-center">
          <svg
            className="w-24 h-24 sm:w-28 sm:h-28"
            viewBox="0 0 100 100"
            fill="currentColor"
          >
            {/* Top-Left Finder Pattern */}
            <rect x="5" y="5" width="30" height="30" rx="4" fill="none" stroke="currentColor" strokeWidth="6" />
            <rect x="13" y="13" width="14" height="14" rx="2" fill="currentColor" />

            {/* Top-Right Finder Pattern */}
            <rect x="65" y="5" width="30" height="30" rx="4" fill="none" stroke="currentColor" strokeWidth="6" />
            <rect x="73" y="13" width="14" height="14" rx="2" fill="currentColor" />

            {/* Bottom-Left Finder Pattern */}
            <rect x="5" y="65" width="30" height="30" rx="4" fill="none" stroke="currentColor" strokeWidth="6" />
            <rect x="13" y="73" width="14" height="14" rx="2" fill="currentColor" />

            {/* Simulated Data Bits */}
            <rect x="42" y="10" width="6" height="6" fill="currentColor" />
            <rect x="52" y="10" width="6" height="6" fill="currentColor" />
            <rect x="42" y="24" width="6" height="14" fill="currentColor" />
            <rect x="52" y="20" width="6" height="8" fill="currentColor" />

            <rect x="10" y="42" width="10" height="6" fill="currentColor" />
            <rect x="25" y="42" width="8" height="6" fill="currentColor" />
            <rect x="10" y="52" width="6" height="6" fill="currentColor" />
            <rect x="22" y="52" width="12" height="6" fill="currentColor" />

            <rect x="42" y="42" width="16" height="16" rx="2" fill="currentColor" />
            <rect x="65" y="42" width="8" height="6" fill="currentColor" />
            <rect x="78" y="42" width="12" height="6" fill="currentColor" />
            <rect x="65" y="52" width="14" height="6" fill="currentColor" />
            <rect x="84" y="52" width="6" height="6" fill="currentColor" />

            <rect x="42" y="65" width="8" height="14" fill="currentColor" />
            <rect x="54" y="65" width="6" height="8" fill="currentColor" />
            <rect x="42" y="84" width="14" height="6" fill="currentColor" />
            <rect x="65" y="68" width="6" height="12" fill="currentColor" />
            <rect x="76" y="68" width="14" height="6" fill="currentColor" />
            <rect x="76" y="78" width="8" height="12" fill="currentColor" />
            <rect x="88" y="78" width="6" height="6" fill="currentColor" />
          </svg>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[240px]">
          打开手机微信或系统相机，扫描二维码即可实时在移动设备继续查阅。
        </p>

        {/* Action Button */}
        <button
          onClick={handleCopy}
          className="w-full py-1.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "研报链接已复制" : "复制手机直达链接"}</span>
        </button>
      </div>
    </IOSWidget>
  );
};
