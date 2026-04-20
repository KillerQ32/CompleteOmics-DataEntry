"use client";

import { useEffect } from "react";

const DATE_INPUT_TYPES = new Set(["date", "datetime-local"]);

function isDateInput(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && DATE_INPUT_TYPES.has(target.type);
}

function clickedCalendarZone(input: HTMLInputElement, clientX: number) {
  const bounds = input.getBoundingClientRect();
  return clientX >= bounds.right - 58;
}

function syncEmptyState(input: HTMLInputElement) {
  input.classList.toggle("date-input--empty", !input.value);
}

export function DateInputEnhancer() {
  useEffect(() => {
    const syncAllDateInputs = () => {
      document.querySelectorAll("input[type='date'], input[type='datetime-local']").forEach((input) => {
        if (input instanceof HTMLInputElement) {
          syncEmptyState(input);
        }
      });
    };

    syncAllDateInputs();

    const closePickerOnSecondIconClick = (event: PointerEvent) => {
      if (!isDateInput(event.target) || !clickedCalendarZone(event.target, event.clientX)) {
        return;
      }

      if (document.activeElement === event.target) {
        event.preventDefault();
        event.target.blur();
      }
    };

    const updateEmptyState = (event: Event) => {
      if (isDateInput(event.target)) {
        syncEmptyState(event.target);
      }
    };

    document.addEventListener("pointerdown", closePickerOnSecondIconClick, true);
    document.addEventListener("input", updateEmptyState, true);
    document.addEventListener("change", updateEmptyState, true);

    return () => {
      document.removeEventListener("pointerdown", closePickerOnSecondIconClick, true);
      document.removeEventListener("input", updateEmptyState, true);
      document.removeEventListener("change", updateEmptyState, true);
    };
  }, []);

  return null;
}
