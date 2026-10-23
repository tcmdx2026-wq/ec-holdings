import os

filepath = 'src/components/app-shell.tsx'
if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Use temp placeholders
    content = content.replace('Task_04', 'TMP_T04')
    content = content.replace('Task_02', 'TMP_T02')
    content = content.replace('Task_03', 'TMP_T03')
    
    content = content.replace('TMP_T04', 'Task_02')
    content = content.replace('TMP_T02', 'Task_03')
    content = content.replace('TMP_T03', 'Task_04')
    
    content = content.replace('Task_04 quick', 'Task_02 quick')
    content = content.replace('Task_04 \u00b7 17:15', 'Task_02 \u00b7 17:15')
    content = content.replace('Task_02 (daily', 'Task_03 (daily')
    content = content.replace('Task_02 daily', 'Task_03 daily')
    content = content.replace('Task_03 report', 'Task_04 report')
    content = content.replace('Task_03 (report', 'Task_04 (report')
    content = content.replace('Task_03 (kind report', 'Task_04 (kind report')
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Updated app-shell.tsx')
    else:
        print('No changes needed')
else:
    print('File not found')