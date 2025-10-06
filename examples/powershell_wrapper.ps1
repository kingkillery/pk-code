# PK Code PowerShell Wrapper
# Enables programmatic agent execution from PowerShell

class PKCode {
    [string]$Model
    [int]$Timeout
    [string]$WorkingDirectory
    [bool]$Yolo
    
    PKCode([string]$Model = "gpt-4", [int]$Timeout = 300, [string]$WorkingDirectory = $null) {
        $this.Model = $Model
        $this.Timeout = $Timeout
        $this.WorkingDirectory = if ($WorkingDirectory) { $WorkingDirectory } else { (Get-Location).Path }
        $this.Yolo = $false
    }
    
    [object] Execute([string]$Prompt, [string[]]$Files = $null, [string]$Context = $null) {
        # Build command
        $cmd = @("pk", "--model", $this.Model, "--prompt", $Prompt)
        
        if ($this.Yolo) {
            $cmd += "--yolo"
        }
        
        # Add file context if provided
        if ($Files) {
            foreach ($file in $Files) {
                if (Test-Path $file) {
                    $cmd += "--file", $file
                } else {
                    Write-Warning "File not found: $file"
                }
            }
        }
        
        # Add context if provided
        if ($Context) {
            $cmd += "--context", $Context
        }
        
        try {
            # Execute PK Code
            $result = Invoke-Command -ScriptBlock {
                & cmd.exe /c "$($cmd -join ' ')" 2>&1
            } -WorkingDirectory $this.WorkingDirectory -ErrorAction Stop
            
            $stdout = $result | Where-Object { $_ -is [string] } | Out-String
            
            return @{
                success = $LASTEXITCODE -eq 0
                response = $stdout.Trim()
                error = if ($LASTEXITCODE -ne 0) { $stdout.Trim() } else { $null }
                return_code = $LASTEXITCODE
                prompt = $Prompt
                model = $this.Model
                files = $Files
            }
        }
        catch {
            return @{
                success = $false
                response = $null
                error = $_.Exception.Message
                return_code = -1
                prompt = $Prompt
                model = $this.Model
                files = $Files
            }
        }
    }
    
    [object] AnalyzeFile([string]$FilePath, [string]$AnalysisType = "general") {
        $prompts = @{
            "general" = "Analyze this file and provide a comprehensive overview of its purpose, structure, and key functionality."
            "security" = "Perform a security analysis of this file, identifying potential vulnerabilities, security issues, and recommendations."
            "performance" = "Analyze this file for performance issues, bottlenecks, and optimization opportunities."
            "code_quality" = "Review this code for quality issues, maintainability, and suggest improvements following best practices."
            "documentation" = "Generate comprehensive documentation for this file, including function descriptions and usage examples."
        }
        
        $prompt = $prompts[$AnalysisType]
        if (-not $prompt) { $prompt = $prompts["general"] }
        
        return $this.Execute($prompt, @($FilePath))
    }
    
    [object[]] BatchAnalyze([string[]]$FilePatterns, [string]$AnalysisType = "general", [int]$MaxConcurrent = 3) {
        # Collect all files matching patterns
        $allFiles = @()
        foreach ($pattern in $FilePatterns) {
            $files = Get-ChildItem -Path $pattern -Recurse -File | Select-Object -ExpandProperty FullName
            $allFiles += $files
        }
        
        # Remove duplicates
        $allFiles = $allFiles | Sort-Object -Unique
        
        Write-Host "Found $($allFiles.Count) files to analyze"
        
        $results = @()
        
        # Process files (PowerShell runs sequentially by default)
        foreach ($file in $allFiles) {
            Write-Host "Analyzing: $file"
            $result = $this.AnalyzeFile($file, $AnalysisType)
            $result.file_path = $file
            $results += $result
            
            if ($result.success) {
                Write-Host "✓ Analyzed: $file" -ForegroundColor Green
            } else {
                Write-Host "✗ Failed to analyze: $file - $($result.error)" -ForegroundColor Red
            }
        }
        
        return $results
    }
    
    [object] RefactorCode([string]$FilePath, [string]$RefactoringGoal) {
        $prompt = @"
        Refactor this code with the following goal: $RefactoringGoal
        
        Please:
        1. Analyze the current code structure
        2. Identify areas for improvement based on the goal
        3. Provide the refactored code
        4. Explain the changes made and why they improve the code
        5. Ensure the refactored code maintains the same functionality
"@
        
        $this.Yolo = $true
        $result = $this.Execute($prompt, @($FilePath))
        $this.Yolo = $false
        return $result
    }
    
    [object] GenerateTests([string]$FilePath, [string]$TestFramework = "pytest") {
        $prompt = @"
        Generate comprehensive tests for this code using $TestFramework.
        
        Please:
        1. Analyze the code structure and functionality
        2. Identify key functions, methods, and edge cases
        3. Generate unit tests that cover:
           - Happy path scenarios
           - Edge cases and error conditions
           - Boundary conditions
        4. Include proper setup and teardown if needed
        5. Add descriptive test names and comments
        6. Follow $TestFramework best practices
"@
        
        $this.Yolo = $true
        $result = $this.Execute($prompt, @($FilePath))
        $this.Yolo = $false
        return $result
    }
    
    [object] CodeReview([string]$FilePath, [string]$ReviewFocus = "general") {
        $focusAreas = @{
            "security" = "security vulnerabilities, authentication, authorization, input validation"
            "performance" = "performance bottlenecks, efficiency, resource usage, scalability"
            "maintainability" = "code readability, structure, documentation, technical debt"
            "best_practices" = "adherence to coding standards, design patterns, conventions"
            "testing" = "test coverage, test quality, testability"
        }
        
        $focus = $focusAreas[$ReviewFocus]
        if (-not $focus) { $focus = "overall code quality and best practices" }
        
        $prompt = @"
        Perform a thorough code review focusing on: $focus
        
        Please provide:
        1. Overall assessment of code quality
        2. Specific issues found with line numbers
        3. Security concerns (if applicable)
        4. Performance considerations
        5. Suggestions for improvement
        6. Best practices recommendations
        7. Priority level for each issue (Critical, High, Medium, Low)
"@
        
        return $this.Execute($prompt, @($FilePath))
    }
}

# Example usage functions
function Show-ExampleUsage {
    Write-Host "=== PK Code PowerShell Wrapper Examples ===" -ForegroundColor Cyan
    
    # Initialize PK Code
    $pk = [PKCode]::new("gpt-4")
    
    # Example 1: Simple prompt execution
    Write-Host "`n1. Simple prompt execution:" -ForegroundColor Yellow
    $result = $pk.Execute("Explain the concept of recursion in programming")
    Write-Host "Success: $($result.success)"
    Write-Host "Response: $($result.response.Substring(0, [Math]::Min(200, $result.response.Length)))..." 
    
    # Example 2: File analysis (if file exists)
    $testFile = "example.py"
    if (Test-Path $testFile) {
        Write-Host "`n2. File analysis:" -ForegroundColor Yellow
        $result = $pk.AnalyzeFile($testFile, "code_quality")
        Write-Host "Analysis result: $($result.success)"
        Write-Host "Response: $($result.response.Substring(0, [Math]::Min(300, $result.response.Length)))..."
    }
    
    # Example 3: Batch analysis
    Write-Host "`n3. Batch analysis:" -ForegroundColor Yellow
    $results = $pk.BatchAnalyze(@("*.py", "*.js"), "general")
    Write-Host "Analyzed $($results.Count) files"
    $successful = ($results | Where-Object { $_.success }).Count
    Write-Host "Successful: $successful, Failed: $($results.Count - $successful)"
}

function Start-BatchProcessing {
    Write-Host "=== Batch Processing Example ===" -ForegroundColor Cyan
    
    $pk = [PKCode]::new("claude-3-5-sonnet")
    
    # Define files to process
    $filesToProcess = @(
        "src/auth.py",
        "src/database.py", 
        "src/api.py",
        "src/utils.py"
    )
    
    # Process each file with different analysis types
    $analysisTasks = @(
        @{ File = "src/auth.py"; Type = "security" },
        @{ File = "src/database.py"; Type = "performance" },
        @{ File = "src/api.py"; Type = "code_quality" },
        @{ File = "src/utils.py"; Type = "documentation" }
    )
    
    $results = @()
    
    Write-Host "Starting batch processing..." -ForegroundColor Green
    
    foreach ($task in $analysisTasks) {
        if (Test-Path $task.File) {
            Write-Host "Processing $($task.File) with $($task.Type) analysis..." -ForegroundColor Yellow
            $result = $pk.AnalyzeFile($task.File, $task.Type)
            $result.file_path = $task.File
            $result.analysis_type = $task.Type
            $results += $result
            
            if ($result.success) {
                Write-Host "✓ Completed $($task.File)" -ForegroundColor Green
            } else {
                Write-Host "✗ Failed $($task.File): $($result.error)" -ForegroundColor Red
            }
        } else {
            Write-Host "⚠ File not found: $($task.File)" -ForegroundColor Yellow
        }
    }
    
    # Generate summary report
    Write-Host "`n=== Batch Processing Summary ===" -ForegroundColor Cyan
    $successful = ($results | Where-Object { $_.success }).Count
    Write-Host "Total files processed: $($results.Count)"
    Write-Host "Successful: $successful"
    Write-Host "Failed: $($results.Count - $successful)"
    
    # Save results to JSON file
    $json = $results | ConvertTo-Json -Depth 10
    $json | Out-File -FilePath "batch_analysis_results.json" -Encoding UTF8
    Write-Host "Results saved to batch_analysis_results.json" -ForegroundColor Green
}

function Start-InteractiveLoop {
    Write-Host "=== PK Code Interactive Loop ===" -ForegroundColor Cyan
    Write-Host "Enter prompts to process with PK Code. Type 'exit' to quit." -ForegroundColor Green
    
    $pk = [PKCode]::new("gpt-4")
    
    while ($true) {
        $prompt = Read-Host "PK Code Prompt"
        
        if ($prompt -eq "exit") {
            break
        }
        
        if ([string]::IsNullOrWhiteSpace($prompt)) {
            continue
        }
        
        Write-Host "Processing..." -ForegroundColor Yellow
        $result = $pk.Execute($prompt)
        
        if ($result.success) {
            Write-Host "Response:" -ForegroundColor Green
            Write-Host $result.response
        } else {
            Write-Host "Error:" -ForegroundColor Red
            Write-Host $result.error
        }
        
        Write-Host "---" -ForegroundColor Gray
    }
}

# Export functions if module is imported
Export-ModuleMember -Function Show-ExampleUsage, Start-BatchProcessing, Start-InteractiveLoop

# Run examples if script is executed directly
if ($MyInvocation.InvocationName -eq $MyInvocation.MyCommand.Name) {
    $action = $args[0]
    
    switch ($action) {
        "example" { Show-ExampleUsage }
        "batch" { Start-BatchProcessing }
        "interactive" { Start-InteractiveLoop }
        default {
            Write-Host "PK Code PowerShell Wrapper" -ForegroundColor Cyan
            Write-Host "Usage:" -ForegroundColor White
            Write-Host "  .\powershell_wrapper.ps1 example      # Run example usage"
            Write-Host "  .\powershell_wrapper.ps1 batch        # Run batch processing example"
            Write-Host "  .\powershell_wrapper.ps1 interactive  # Start interactive loop"
            Write-Host ""
            Write-Host "Or use the PKCode class in your own scripts:" -ForegroundColor White
            Write-Host "  . .\powershell_wrapper.ps1"
            Write-Host "  `$pk = [PKCode]::new()"
            Write-Host "  `$result = `$pk.Execute('Your prompt here')"
        }
    }
}