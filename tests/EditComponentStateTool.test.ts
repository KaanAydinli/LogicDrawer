import { describe, expect, it, vi } from "vitest";
import { EditComponentStateTool } from "../src/ai/tools/EditComponentStateTool";

describe("EditComponentStateTool", () => {
  it("updates component state and triggers simulation", async () => {
    const setState = vi.fn();
    const component = { id: "comp-1", type: "multibit", setState };
    const getComponentById = vi.fn().mockImplementation((id: string) => {
      if (id === "comp-1") return component;
      return null;
    });
    const simulate = vi.fn();
    const draw = vi.fn();

    const tool = new EditComponentStateTool();
    const result = await tool.execute({
      message: "edit",
      circuitBoard: {
        getComponentById,
        simulate,
        draw,
      } as any,
      queue: {} as any,
      promptAI: "",
      imageUploader: {} as any,
      edits: [{ componentId: "comp-1", state: { defaultBitWidth: 8, isMultiBit: true } }],
    } as any);

    const parsed = JSON.parse(result);

    expect(setState).toHaveBeenCalledWith({ defaultBitWidth: 8, isMultiBit: true });
    expect(simulate).toHaveBeenCalledTimes(1);
    expect(draw).not.toHaveBeenCalled();
    expect(parsed.message).toContain("Updated 1 component(s)");
  });

  it("returns failure details and redraws when nothing is updated", async () => {
    const getComponentById = vi.fn().mockReturnValue(null);
    const simulate = vi.fn();
    const draw = vi.fn();

    const tool = new EditComponentStateTool();
    const result = await tool.execute({
      message: "edit",
      circuitBoard: {
        getComponentById,
        simulate,
        draw,
      } as any,
      queue: {} as any,
      promptAI: "",
      imageUploader: {} as any,
      edits: [{ componentId: "missing", state: { rotation: 90 } }],
    } as any);

    const parsed = JSON.parse(result);

    expect(parsed.details).toContain("Failed: Component not found (missing)");
    expect(simulate).not.toHaveBeenCalled();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it("handles text attachment state with attachedToId", async () => {
    const setState = vi.fn();
    const attachToComponent = vi.fn();
    const textComponent = { id: "text-1", type: "text", setState, attachToComponent };
    const gateComponent = { id: "gate-1", type: "and", setState: vi.fn() };

    const getComponentById = vi.fn().mockImplementation((id: string) => {
      if (id === "text-1") return textComponent;
      if (id === "gate-1") return gateComponent;
      return null;
    });

    const tool = new EditComponentStateTool();
    await tool.execute({
      message: "edit",
      circuitBoard: {
        getComponentById,
        simulate: vi.fn(),
        draw: vi.fn(),
      } as any,
      queue: {} as any,
      promptAI: "",
      imageUploader: {} as any,
      edits: [{ componentId: "text-1", state: { text: "ALU", attachedToId: "gate-1" } }],
    } as any);

    expect(setState).toHaveBeenCalledWith({ text: "ALU", attachedToId: "gate-1" });
    expect(attachToComponent).toHaveBeenCalledWith(gateComponent);
  });
});
