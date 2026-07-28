import os
import re

# Define the replacements
replacements = {
    # Class names
    'PiLocator': 'SdLocator',
    'PiProcess': 'SdProcess',
    'PiRpcClient': 'SdRpcClient',
    'PiProxyTester': 'SdProxyTester',
    'PiRuntimeEvent': 'SdRuntimeEvent',
    'PiModelItem': 'SdModelItem',
    'PiProviderConfig': 'SdProviderConfig',
    'PiModelsFile': 'SdModelsFile',
    'PiAuthItem': 'SdAuthItem',
    'PiAuthFile': 'SdAuthFile',
    'PiSettings': 'SdSettings',
    
    # Property names
    'piEnvironmentChecked': 'sdEnvironmentChecked',
    'piProxyEnabled': 'sdProxyEnabled',
    'piProxyUrl': 'sdProxyUrl',
    'piProxyBypass': 'sdProxyBypass',
    'customPiPath': 'customSdPath',
    'piPackageName': 'sdPackageName',
    
    # IPC channels
    'pi:check': 'sd:check',
    'pi:check-custom': 'sd:check-custom',
    'pi:update-check': 'sd:update-check',
    'pi:update': 'sd:update',
    'pi:exec-install': 'sd:exec-install',
    'pi:check-npm': 'sd:check-npm',
    
    # Type literals
    '"pi-global"': '"sd-global"',
    '"project-pi"': '"project-sd"',
    
    # Paths
    '.pi/agent': '.sd/agent',
    '.pi\\agent': '.sd\\agent',
}

# File patterns to process
file_patterns = ['.ts', '.tsx', '.md', '.json']

# Directories to skip
skip_dirs = ['node_modules', '.git', 'vendor']

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        for old, new in replacements.items():
            content = content.replace(old, new)
        
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated: {filepath}")
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    updated_count = 0
    total_count = 0
    
    for root, dirs, files in os.walk('src'):
        # Skip directories
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        
        for filename in files:
            if any(filename.endswith(pattern) for pattern in file_patterns):
                total_count += 1
                filepath = os.path.join(root, filename)
                if process_file(filepath):
                    updated_count += 1
    
    print(f"\nTotal files: {total_count}")
    print(f"Updated files: {updated_count}")

if __name__ == '__main__':
    main()
