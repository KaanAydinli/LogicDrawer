import { describe, expect, it, vi } from "vitest";
import { EditComponentStateTool } from "../src/ai/tools/EditComponentStateTool";

describe("EditComponentStateTool", () => {
  it("updates component state and triggers simulation", async () => {
    let appliedState: Record<string, unknown> = {};
    const setState = vi.fn((state: Record<string, unknown>) => {
      appliedState = { ...appliedState, ...state };
    });
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

    expect(setState).toHaveBeenCalledWith({ bitWidth: 8, defaultBitWidth: 8, isMultiBit: true });
    expect(appliedState.bitWidth).toBe(8);
    expect(appliedState.defaultBitWidth).toBe(8);
    expect(appliedState.isMultiBit).toBe(true);
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

  it("supports single-field partial state updates", async () => {
    let appliedState: Record<string, unknown> = {};
    const setState = vi.fn((state: Record<string, unknown>) => {
      appliedState = { ...appliedState, ...state };
    });
    const component = { id: "comp-2", type: "clock", setState };
    const getComponentById = vi.fn().mockImplementation((id: string) => {
      if (id === "comp-2") return component;
      return null;
    });

    const tool = new EditComponentStateTool();
    const result = await tool.execute({
      message: "edit",
      circuitBoard: {
        getComponentById,
        simulate: vi.fn(),
        draw: vi.fn(),
      } as any,
      queue: {} as any,
      promptAI: "",
      imageUploader: {} as any,
      edits: [{ componentId: "comp-2", state: { defaultBitWidth: 16 } }],
    } as any);

    const parsed = JSON.parse(result);
    expect(setState).toHaveBeenCalledWith({ bitWidth: 16, defaultBitWidth: 16 });
    expect(appliedState).toEqual({ bitWidth: 16, defaultBitWidth: 16 });
    expect(parsed.message).toContain("Updated 1 component(s)");
  });

  it("maps bitWidth edits to defaultBitWidth for compatibility", async () => {
    const setState = vi.fn();
    const component = { id: "comp-3", type: "and", setState };
    const getComponentById = vi.fn().mockImplementation((id: string) => {
      if (id === "comp-3") return component;
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
      edits: [{ componentId: "comp-3", state: { bitWidth: 4 } }],
    } as any);

    expect(setState).toHaveBeenCalledWith({ bitWidth: 4, defaultBitWidth: 4 });
  });

  it("maps defaultBitWidth edits to bitWidth for compatibility", async () => {
    const setState = vi.fn();
    const component = { id: "comp-3b", type: "multibit", setState };
    const getComponentById = vi.fn().mockImplementation((id: string) => {
      if (id === "comp-3b") return component;
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
      edits: [{ componentId: "comp-3b", state: { defaultBitWidth: 12 } }],
    } as any);

    expect(setState).toHaveBeenCalledWith({ bitWidth: 12, defaultBitWidth: 12 });
  });

  it("keeps explicit bitWidth and defaultBitWidth values when both are provided", async () => {
    const setState = vi.fn();
    const component = { id: "comp-6", type: "multibit", setState };
    const getComponentById = vi.fn().mockImplementation((id: string) => {
      if (id === "comp-6") return component;
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
      edits: [{ componentId: "comp-6", state: { bitWidth: 4, defaultBitWidth: 8 } }],
    } as any);

    expect(setState).toHaveBeenCalledWith({ bitWidth: 4, defaultBitWidth: 8 });
  });

  it("rejects empty state payloads", async () => {
    const setState = vi.fn();
    const component = { id: "comp-4", type: "and", setState };
    const getComponentById = vi.fn().mockReturnValue(component);
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
      edits: [{ componentId: "comp-4", state: {} }],
    } as any);

    const parsed = JSON.parse(result);
    expect(parsed.details).toContain("Failed: Empty state payload (comp-4)");
    expect(setState).not.toHaveBeenCalled();
    expect(simulate).not.toHaveBeenCalled();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it("reports mixed success while still simulating once", async () => {
    const setState = vi.fn();
    const component = { id: "comp-5", type: "clock", setState };
    const getComponentById = vi.fn().mockImplementation((id: string) => {
      if (id === "comp-5") return component;
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
      edits: [
        { componentId: "comp-5", state: { interval: 250 } },
        { componentId: "missing", state: { defaultBitWidth: 8 } },
      ],
    } as any);

    const parsed = JSON.parse(result);
    expect(parsed.details).toContain("Updated: clock(comp-5)");
    expect(parsed.details).toContain("Failed: Component not found (missing)");
    expect(simulate).toHaveBeenCalledTimes(1);
    expect(draw).not.toHaveBeenCalled();
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
