import os
import sys
import shutil
import zipfile

def package_ipa():
    print("==================================================")
    print("    STYLXH TEST OPS - Local Packager (for KSign)  ")
    print("==================================================")

    current_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(current_dir, "dist")
    payload_dir = os.path.join(current_dir, "Payload")
    app_dir = os.path.join(payload_dir, "STYLXHTestOps.app")
    output_ipa = os.path.join(current_dir, "STYLXHTestOps.ipa")

    if not os.path.exists(dist_dir):
        print("[ERROR] 'dist' directory not found.")
        print("Please run: npx expo export -p web")
        sys.exit(1)

    # Clean previous build artifacts
    if os.path.exists(payload_dir):
        shutil.rmtree(payload_dir)
    if os.path.exists(output_ipa):
        os.remove(output_ipa)

    os.makedirs(app_dir, exist_ok=True)

    print("[1/3] Copying bundled offline assets into iOS App container...")
    for item in os.listdir(dist_dir):
        src = os.path.join(dist_dir, item)
        dst = os.path.join(app_dir, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

    # Fix relative paths in index.html so it loads properly from local bundle
    index_path = os.path.join(app_dir, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            html = f.read()
        # Make script tags and asset urls relative (remove leading slash)
        html = html.replace('src="/', 'src="').replace('href="/', 'href="')
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(html)
        print("  -> Converted index.html asset paths to local relative format.")

    # Info.plist tailored for iOS & KSign
    info_plist_content = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>STYLXH TEST OPS</string>
    <key>CFBundleExecutable</key>
    <string>STYLXHTestOps</string>
    <key>CFBundleIdentifier</key>
    <string>com.stylxh.testops</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>STYLXHTestOps</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>UIRequiresFullScreen</key>
    <true/>
    <key>UIStatusBarHidden</key>
    <false/>
    <key>UIStatusBarStyle</key>
    <string>UIStatusBarStyleLightContent</string>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
    </array>
    <key>NSCameraUsageDescription</key>
    <string>Used for photo verification of media player swap.</string>
    <key>NSPhotoLibraryUsageDescription</key>
    <string>Used to attach job reference documentation.</string>
</dict>
</plist>
"""
    print("[2/3] Writing iOS Info.plist and metadata...")
    with open(os.path.join(app_dir, "Info.plist"), "w", encoding="utf-8") as f:
        f.write(info_plist_content)

    print("[3/3] Compressing Payload into ITHeroOps.ipa...")
    with zipfile.ZipFile(output_ipa, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(payload_dir):
            for file in files:
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, current_dir)
                zipf.write(abs_path, rel_path)

    # Clean temporary payload directory
    shutil.rmtree(payload_dir)

    print("\n==================================================")
    print("SUCCESS! Created IPA:")
    print(f"File: {output_ipa}")
    size_mb = os.path.getsize(output_ipa) / (1024 * 1024)
    print(f"Size: {size_mb:.2f} MB")
    print("==================================================")
    print("Ready to transfer to iPhone and sign with KSign!")

if __name__ == "__main__":
    package_ipa()
