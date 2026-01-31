// Simple toast notification utility
type ToastType = "success" | "error" | "warning" | "info";

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

class ToastManager {
  private container: HTMLDivElement | null = null;

  private ensureContainer() {
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "toast-container";
      this.container.className = "fixed top-4 right-4 z-50 flex flex-col gap-2";
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  private getIcon(type: ToastType) {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      case "info":
        return "ℹ";
    }
  }

  private getColors(type: ToastType) {
    switch (type) {
      case "success":
        return "bg-green-500 text-white";
      case "error":
        return "bg-red-500 text-white";
      case "warning":
        return "bg-yellow-500 text-white";
      case "info":
        return "bg-blue-500 text-white";
    }
  }

  show({ message, type = "info", duration = 3000 }: ToastOptions) {
    const container = this.ensureContainer();

    const toast = document.createElement("div");
    toast.className = `${this.getColors(type)} px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 min-w-[300px] animate-slide-in-right`;

    const iconSpan = document.createElement("span");
    iconSpan.className = "text-xl";
    iconSpan.textContent = this.getIcon(type);

    const messageSpan = document.createElement("span");
    messageSpan.className = "flex-1";
    messageSpan.textContent = message;

    const closeBtn = document.createElement("button");
    closeBtn.className = "ml-2 hover:opacity-80";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "\u2715";

    toast.appendChild(iconSpan);
    toast.appendChild(messageSpan);
    toast.appendChild(closeBtn);

    const remove = () => {
      toast.classList.add("animate-slide-out-right");
      setTimeout(() => {
        if (toast.parentNode === container) {
          container.removeChild(toast);
        }
        if (container.children.length === 0 && this.container) {
          document.body.removeChild(this.container);
          this.container = null;
        }
      }, 300);
    };

    closeBtn.addEventListener("click", remove);
    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(remove, duration);
    }
  }

  success(message: string, duration?: number) {
    this.show({ message, type: "success", duration });
  }

  error(message: string, duration?: number) {
    this.show({ message, type: "error", duration });
  }

  warning(message: string, duration?: number) {
    this.show({ message, type: "warning", duration });
  }

  info(message: string, duration?: number) {
    this.show({ message, type: "info", duration });
  }
}

export const toast = new ToastManager();
