# PowerShell script to set up MetaMatching MongoDB database
# Make sure MongoDB is running before executing this script

Write-Host "🚀 Setting up MetaMatching MongoDB Database..." -ForegroundColor Green

# Check if MongoDB is running
Write-Host "Checking if MongoDB is running..." -ForegroundColor Yellow
$mongoProcess = Get-Process -Name "mongod" -ErrorAction SilentlyContinue

if (-not $mongoProcess) {
    Write-Host "❌ MongoDB is not running. Please start MongoDB first." -ForegroundColor Red
    Write-Host "💡 Tip: Run 'mongod' or start MongoDB service" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ MongoDB is running" -ForegroundColor Green

# Check if mongosh is available
Write-Host "Checking for mongosh (MongoDB Shell)..." -ForegroundColor Yellow
$mongoshPath = Get-Command "mongosh" -ErrorAction SilentlyContinue

if (-not $mongoshPath) {
    Write-Host "❌ mongosh not found. Please install MongoDB Shell." -ForegroundColor Red
    Write-Host "💡 Download from: https://www.mongodb.com/docs/mongodb-shell/install/" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ mongosh found at: $($mongoshPath.Source)" -ForegroundColor Green

# Run the database setup script
Write-Host "🔧 Executing database setup script..." -ForegroundColor Yellow

try {
    $setupScriptPath = "setup_xenogenesis_db.js"
    
    if (-not (Test-Path $setupScriptPath)) {
        Write-Host "❌ Setup script not found: $setupScriptPath" -ForegroundColor Red
        exit 1
    }
    
    # Execute the MongoDB script
    mongosh "mongodb://localhost:27017" $setupScriptPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n🎉 Database setup completed successfully!" -ForegroundColor Green
        Write-Host "📚 Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Update Database.js: Set USE_DB = true" -ForegroundColor White
        Write-Host "  2. Install mongojs if not already installed: npm install mongojs" -ForegroundColor White
        Write-Host "  3. Restart your application" -ForegroundColor White
        Write-Host "`n👥 Sample Accounts Created:" -ForegroundColor Cyan
        Write-Host "  Admin: admin/admin123" -ForegroundColor White
        Write-Host "  Admin: gamemaster/gm123" -ForegroundColor White  
        Write-Host "  User: alice/alice123" -ForegroundColor White
        Write-Host "  User: bob/bob123" -ForegroundColor White
        Write-Host "  User: charlie/charlie123" -ForegroundColor White
        Write-Host "  User: diana/diana123" -ForegroundColor White
    } else {
        Write-Host "❌ Database setup failed!" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "❌ Error executing setup script: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n✨ MetaMatching MongoDB Database is ready!" -ForegroundColor Green