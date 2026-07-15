import svgPaths from "./svg-17xoocnk8g";

export default function Component({ className }: { className?: string }) {
  return (
    <div className={className || "h-[166px] relative w-[580px]"} data-name="Component 2">
      <div className="absolute flex inset-[6.02%_76.49%_0_0] items-center justify-center" style={{ containerType: "size" }}>
        <div className="-rotate-180 -scale-x-100 flex-none h-[100cqh] w-[100cqw]">
          <div className="relative size-full" data-name="Group">
            <svg className="absolute block inset-0 size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 136.334 156">
              <g id="Group">
                <path d={svgPaths.p366521c0} fill="var(--fill-0, #0B1020)" id="Vector" />
                <path d={svgPaths.p35a96b00} fill="var(--fill-0, #5A5CFF)" id="Ellipse 1" />
              </g>
            </svg>
          </div>
        </div>
      </div>
      <p className="[word-break:break-word] absolute font-['SN_Pro:SemiBold',sans-serif] font-semibold inset-[0_0_8.43%_28.28%] leading-[normal] text-[128px] text-black">cadova</p>
    </div>
  );
}