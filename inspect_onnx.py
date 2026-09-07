import sys
import os
import onnx

def inspect_onnx(model_path):
    if not os.path.exists(model_path):
        print(f"[ERROR] Model file not found: {model_path}")
        sys.exit(1)

    print(f"=== Inspecting ONNX Model: {model_path} ===")
    try:
        model = onnx.load(model_path)
        onnx.checker.check_model(model)
        print("✅ ONNX Model Structure & Graph: VALID (Passed onnx.checker)")
    except Exception as e:
        print(f"❌ Validation Error: {e}")
        sys.exit(1)

    print(f"IR Version       : {model.ir_version}")
    print(f"Producer Name    : {model.producer_name}")
    print(f"Producer Version : {model.producer_version}")
    print(f"Model Version    : {model.model_version}")

    print("\n--- Inputs ---")
    for inp in model.graph.input:
        shape = [dim.dim_value if dim.dim_value > 0 else dim.dim_param for dim in inp.type.tensor_type.shape.dim]
        print(f"  • {inp.name} (shape: {shape})")

    print("\n--- Outputs ---")
    for out in model.graph.output:
        shape = [dim.dim_value if dim.dim_value > 0 else dim.dim_param for dim in out.type.tensor_type.shape.dim]
        print(f"  • {out.name} (shape: {shape})")

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "/models/head_pose_model.onnx"
    inspect_onnx(path)
