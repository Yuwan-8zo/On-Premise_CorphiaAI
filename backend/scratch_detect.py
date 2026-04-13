import subprocess
import json

def get_gpu_info():
    try:
        # Run powershell command to get GPU info
        cmd = 'powershell "Get-CimInstance win32_VideoController | Select-Object -Property Name, AdapterRAM | ConvertTo-Json"'
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        if result.returncode == 0 and result.stdout.strip():
            gpu_data = json.loads(result.stdout)
            if isinstance(gpu_data, dict):
                return [gpu_data]
            return gpu_data
    except Exception as e:
        print(f"Error detecting GPU: {e}")
    return []

def recommend_backend():
    gpus = get_gpu_info()
    if not gpus:
        return "CPU"
    
    for gpu in gpus:
        name = gpu.get("Name", "").lower()
        if "nvidia" in name:
            return "CUDA"
        elif "intel" in name or "arc" in name or "amd" in name or "radeon" in name:
            # We use Vulkan for Intel and AMD for maximum compatibility on Windows
            return "Vulkan"
            
    return "CPU"

if __name__ == "__main__":
    gpus = get_gpu_info()
    for g in gpus:
        name = g.get("Name", "Unknown")
        ram = g.get("AdapterRAM", 0) / (1024**3)
        print(f"Found GPU: {name} (VRAM: {ram:.1f} GB)")
    print(f"Recommended Backend: {recommend_backend()}")
