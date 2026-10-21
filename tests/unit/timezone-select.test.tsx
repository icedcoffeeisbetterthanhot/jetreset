import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TimezoneSelect } from "../../src/components/ui/TimezoneSelect";

describe("TimezoneSelect", () => {
  it("renders time zones as dropdown options without a text input", () => {
    render(
      <TimezoneSelect id="originTimeZone" label="Origin time zone" value="" onChange={() => {}} />,
    );

    expect(screen.getByRole("combobox", { name: "Origin time zone" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Europe/London" })).toBeInTheDocument();
  });

  it("reports the selected time zone", () => {
    const onChange = vi.fn();

    render(
      <TimezoneSelect id="originTimeZone" label="Origin time zone" value="" onChange={onChange} />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Europe/London" },
    });

    expect(onChange).toHaveBeenCalledWith("Europe/London");
  });
});
