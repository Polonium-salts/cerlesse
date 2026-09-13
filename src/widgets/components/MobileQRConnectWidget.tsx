import React, { useState } from "react";
import { IOSWidget } from "../../components/ui/IOSWidget.js";
import { Button } from "../../components/ui/button.js";
import { Smartphone, Copy, Check } from "lucide-react";

interface MobileQRConnectWidgetProps {
  url?: string;
  query: string;
}

/**
 * 移动到手机继续 (mobile_qr)
 *
 * shadcn/ui 重做要点：
 *   · 复制按钮换用 shadcn Button（default / 通栏），h-9 rounded-md shadow-xs；
 *   · 链接文本 font-mono text-xs text-muted-foreground，不加装饰性边框；
 *   · 依旧只呈现真实可用信息（当前页面链接 + 一键复制），不画假二维码。
 */
export const MobileQRConnectWidget: React.FC<MobileQRConnectWidgetProps> = ({ url }) => {
  const [copied, setCopied] = useState(false);
  const targetUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  const handleCopy = () => {
    navigator.clipboard?.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <IOSWidget
      id="widget-mobile-qr"
      title="移动到手机继续"
      icon={<Smartphone className="size-4" />}
      className="w-full h-full"
    >
      <div className="flex h-full flex-col justify-center gap-3">
        <p className="line-clamp-3 break-all font-mono text-xs leading-5 text-muted-foreground">
          {targetUrl}
        </p>
        <Button onClick={handleCopy} className="w-full">
          {copied ? <Check /> : <Copy />}
          <span>{copied ? "链接已复制" : "复制链接"}</span>
        </Button>
      </div>
    </IOSWidget>
  );
};
