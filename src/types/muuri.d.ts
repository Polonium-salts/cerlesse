declare module "muuri" {
  export interface MuuriOptions {
    items?: string | HTMLElement[] | NodeList | HTMLElement;
    layout?: {
      fillGaps?: boolean;
      horizontal?: boolean;
      alignRight?: boolean;
      alignBottom?: boolean;
      rounding?: boolean;
    } | ((grid: any, layoutId: number, items: any[], width: number, height: number, callback: Function) => void);
    layoutOnResize?: boolean | number;
    layoutOnInit?: boolean;
    layoutDuration?: number;
    layoutEasing?: string;
    dragEnabled?: boolean;
    dragContainer?: HTMLElement;
    dragStartPredicate?: {
      distance?: number;
      delay?: number;
      handle?: string;
    };
    dragAxis?: "x" | "y" | "xy";
    dragSort?: boolean | { (item: any): any };
    dragAutoScroll?: any;
    dragRelease?: {
      duration?: number;
      easing?: string;
      useRequestAnimationFrame?: boolean;
    };
    containerClass?: string;
    itemClass?: string;
    itemVisibleClass?: string;
    itemHiddenClass?: string;
    itemPositioningClass?: string;
    itemDraggingClass?: string;
    itemReleasingClass?: string;
    itemPlaceholderClass?: string;
    visibleStyles?: Record<string, string | number>;
    hiddenStyles?: Record<string, string | number>;
  }

  export class Item {
    getElement(): HTMLElement;
    getWidth(): number;
    getHeight(): number;
    getMargin(): { left: number; right: number; top: number; bottom: number };
    getPosition(): { left: number; top: number };
    isActive(): boolean;
    isVisible(): boolean;
    isDragging(): boolean;
    isPositioning(): boolean;
    isHiding(): boolean;
    isShowing(): boolean;
  }

  export default class Muuri {
    constructor(element: string | HTMLElement, options?: MuuriOptions);
    add(elements: HTMLElement | HTMLElement[], options?: { index?: number; layout?: boolean | string }): Item[];
    remove(items: Item[] | HTMLElement[], options?: { removeElements?: boolean; layout?: boolean | string }): Item[];
    layout(instant?: boolean, callback?: (items: Item[]) => void): this;
    getItems(): Item[];
    refreshItems(items?: Item[] | HTMLElement[]): this;
    reloadItems(): this;
    synchronize(): this;
    destroy(removeElements?: boolean): this;
    on(event: string, handler: Function): this;
    off(event: string, handler: Function): this;
  }
}
