const db = require('./connection');

async function testGreatLifeStructure() {
  console.log('🧪 Testing GreatLIFE Company Structure\n');
  
  try {
    // Insert PA company files (33 total)
    console.log('📝 Inserting Pennsylvania company files...');
    for (let i = 1; i <= 30; i++) {
      await db.insertCompanyFile({
        company_name: `PA Location ${i}`,
        department_structure: JSON.stringify({
          "1": "Golf Shop",
          "2": "F&B",
          "3": "Course Maintenance",
          "4": "Building Maintenance",
          "5": "Pool",
          "6": "Admin",
          "7": "Marketing"
        }),
        file_type: 'PA_location',
        qb_version: '15.0',
        location: 'Pennsylvania',
        file_path: `/qb/pa/location_${i}.qbw`,
        qb_type: 'Accountant Desktop Plus 2024'
      });
    }
    
    // PA Corporate files
    await db.insertCompanyFile({
      company_name: 'PA Corporate',
      file_type: 'PA_corporate',
      qb_version: '15.0',
      location: 'Pennsylvania',
      file_path: '/qb/pa/corporate.qbw',
      qb_type: 'Accountant Desktop Plus 2024'
    });
    
    await db.insertCompanyFile({
      company_name: 'PA Corporate 2',
      file_type: 'PA_corporate',
      qb_version: '15.0',
      location: 'Pennsylvania',
      file_path: '/qb/pa/corporate2.qbw',
      qb_type: 'Accountant Desktop Plus 2024'
    });
    
    await db.insertCompanyFile({
      company_name: 'PA Old Corporate',
      file_type: 'PA_corporate',
      qb_version: '15.0',
      location: 'Pennsylvania',
      file_path: '/qb/pa/old_corporate.qbw',
      qb_type: 'Accountant Desktop Plus 2024'
    });
    
    console.log('✅ Inserted 33 PA files');
    
    // Insert Midwest files
    console.log('\n📝 Inserting Midwest company files...');
    
    await db.insertCompanyFile({
      company_name: 'Midwest Enterprise - 15 Courses',
      department_structure: JSON.stringify({
        "classes": ["Course 1", "Course 2", "Course 3", "Course 4", "Course 5",
                    "Course 6", "Course 7", "Course 8", "Course 9", "Course 10",
                    "Course 11", "Course 12", "Course 13", "Course 14", "Course 15"]
      }),
      file_type: 'Midwest_enterprise',
      qb_version: '16.0',
      location: 'Midwest',
      file_path: '/qb/midwest/enterprise.qbw',
      qb_type: 'Enterprise 2025'
    });
    
    await db.insertCompanyFile({
      company_name: 'Midwest Other 1',
      file_type: 'Midwest_other',
      qb_version: '16.0',
      location: 'Midwest',
      file_path: '/qb/midwest/other1.qbw',
      qb_type: 'Enterprise 2025'
    });
    
    await db.insertCompanyFile({
      company_name: 'Midwest Other 2',
      file_type: 'Midwest_other',
      qb_version: '16.0',
      location: 'Midwest',
      file_path: '/qb/midwest/other2.qbw',
      qb_type: 'Enterprise 2025'
    });
    
    console.log('✅ Inserted 3 Midwest files');
    
    // Query all companies
    console.log('\n📊 Summary:');
    const allCompanies = await db.getAllCompanyFiles();
    console.log(`Total companies: ${allCompanies.length}`);
    
    const paLocations = allCompanies.filter(c => c.file_type === 'PA_location');
    const paCorporate = allCompanies.filter(c => c.file_type === 'PA_corporate');
    const midwestEnterprise = allCompanies.filter(c => c.file_type === 'Midwest_enterprise');
    const midwestOther = allCompanies.filter(c => c.file_type === 'Midwest_other');
    
    console.log(`  PA Locations: ${paLocations.length}`);
    console.log(`  PA Corporate: ${paCorporate.length}`);
    console.log(`  Midwest Enterprise: ${midwestEnterprise.length}`);
    console.log(`  Midwest Other: ${midwestOther.length}`);
    
    console.log('\n✅ GreatLIFE structure loaded successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testGreatLifeStructure();