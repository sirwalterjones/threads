const { pool } = require('../config/database');

async function createSampleBOLOs() {
  const client = await pool.connect();
  
  try {
    // Get a user ID to use as creator
    const userResult = await client.query(
      "SELECT id FROM users WHERE role IN ('admin', 'edit') LIMIT 1"
    );
    
    if (userResult.rows.length === 0) {
      console.error('No admin or edit user found');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log('Using user ID:', userId);
    
    // Sample BOLOs
    const sampleBOLOs = [
      {
        type: 'person',
        priority: 'immediate',
        subject_name: 'Emily Rodriguez',
        subject_aliases: ['Em', 'Emmy'],
        subject_description: 'Hispanic female, 5\'6", 130 lbs, last seen wearing blue jeans and red hoodie',
        date_of_birth: '2008-03-15',
        age_range: '15-16',
        height: '5\'6"',
        weight: '130 lbs',
        hair_color: 'Black',
        eye_color: 'Brown',
        distinguishing_features: 'Small scar above left eyebrow, butterfly tattoo on right wrist',
        last_seen_wearing: 'Blue jeans, red hoodie with "Canyon High School" logo, white Nike sneakers',
        armed_dangerous: false,
        incident_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        incident_location: '2300 Block of Main Street, Canton, GA',
        last_known_location: 'Canton High School parking lot',
        jurisdiction: 'Cherokee County',
        title: 'Missing Juvenile - Emily Rodriguez',
        summary: 'Missing 15-year-old female, last seen leaving school yesterday afternoon. Family concerned for her safety.',
        narrative: 'Emily Rodriguez was last seen leaving Canton High School at approximately 3:30 PM yesterday. She did not return home and has not contacted family or friends. She left on foot and was possibly upset about a recent argument with friends. She has no history of running away. Her cell phone is going straight to voicemail.',
        officer_safety_info: 'Subject is not considered dangerous. Approach with caution as subject may be emotional or scared.',
        approach_instructions: 'If located, verify identity and check welfare. Contact family immediately.',
        agency_name: 'Cherokee Sheriff\'s Office',
        contact_info: 'Detective Johnson - 770-555-0123',
        is_public: true
      },
      {
        type: 'person',
        priority: 'high',
        subject_name: 'Marcus Thompson',
        subject_aliases: ['Big Marc', 'MT'],
        subject_description: 'Black male, 6\'2", 220 lbs, muscular build, beard',
        date_of_birth: '1985-07-22',
        age_range: '38-39',
        height: '6\'2"',
        weight: '220 lbs',
        hair_color: 'Black',
        eye_color: 'Brown',
        distinguishing_features: 'Tribal tattoo on left shoulder, gold front tooth',
        last_seen_wearing: 'Black jacket, dark jeans, black baseball cap',
        armed_dangerous: true,
        armed_dangerous_details: 'Subject should be considered armed and dangerous. Known to carry firearms.',
        vehicle_make: 'Dodge',
        vehicle_model: 'Charger',
        vehicle_year: '2019',
        vehicle_color: 'Black',
        license_plate: 'ABC-1234',
        vehicle_features: 'Tinted windows, chrome rims, loud exhaust',
        incident_date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
        incident_location: 'Woodstock, GA',
        last_known_location: 'Atlanta Metro Area',
        jurisdiction: 'Multi-County',
        title: 'Armed Robbery Suspect - Marcus Thompson',
        summary: 'Wanted for armed robbery of convenience store. Subject should be considered armed and dangerous.',
        narrative: 'Marcus Thompson is wanted in connection with an armed robbery that occurred at the QuickStop on Highway 92. Subject displayed a firearm and demanded cash from the register. He fled in a black Dodge Charger heading southbound. Subject has prior arrests for assault and weapons charges.',
        officer_safety_info: 'ARMED AND DANGEROUS - Subject has history of violence and weapons charges. Approach with extreme caution.',
        approach_instructions: 'Do not attempt to apprehend alone. Request backup before making contact.',
        agency_name: 'Woodstock Police Department',
        contact_info: 'Sergeant Davis - 770-555-0456',
        is_public: true
      },
      {
        type: 'vehicle',
        priority: 'medium',
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        vehicle_year: '2021',
        vehicle_color: 'Silver',
        license_plate: 'RKJ-8976',
        vehicle_vin: '4T1B11HK7MU123456',
        vehicle_features: 'Slight dent on rear bumper, "Baby on Board" sticker',
        incident_date: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        incident_location: 'Cherokee Town Center Mall',
        last_known_location: 'Cherokee County',
        jurisdiction: 'Cherokee County',
        title: 'Stolen Vehicle - 2021 Silver Toyota Camry',
        summary: 'Vehicle stolen from mall parking lot. Keys were left in vehicle.',
        narrative: 'A 2021 Silver Toyota Camry was reported stolen from the Cherokee Town Center Mall parking lot. The owner left the vehicle running with keys inside while quickly running into a store. When they returned 10 minutes later, the vehicle was gone. Mall security cameras show an unknown subject entering and driving away with the vehicle.',
        agency_name: 'Canton Police Department',
        contact_info: 'Officer Williams - 770-555-0789',
        is_public: true
      },
      {
        type: 'person',
        priority: 'high',
        subject_name: 'Robert Anderson',
        subject_aliases: ['Bob', 'Bobby'],
        subject_description: 'White male, 5\'10", 180 lbs, gray hair, may appear confused',
        date_of_birth: '1945-11-30',
        age_range: '78-79',
        height: '5\'10"',
        weight: '180 lbs',
        hair_color: 'Gray',
        eye_color: 'Blue',
        distinguishing_features: 'Walks with a cane, wears glasses, has Alzheimer\'s',
        last_seen_wearing: 'Brown cardigan, khaki pants, brown loafers',
        armed_dangerous: false,
        incident_date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        incident_location: 'Sunset Assisted Living Facility, Ball Ground, GA',
        last_known_location: 'Ball Ground area',
        jurisdiction: 'Cherokee County',
        title: 'Missing Elderly Person with Dementia - Robert Anderson',
        summary: 'Elderly male with Alzheimer\'s wandered from care facility. May be confused and unable to find way back.',
        narrative: 'Robert Anderson walked away from Sunset Assisted Living Facility during the night. He suffers from moderate Alzheimer\'s disease and may not know where he is or how to return. He is diabetic and requires medication. He may believe he is going to work or looking for his deceased wife. He is not dressed for cold weather.',
        officer_safety_info: 'Subject is not dangerous but may be confused or frightened. Approach calmly.',
        approach_instructions: 'Approach slowly and calmly. Identify yourself clearly. Subject may not recognize he is lost.',
        agency_name: 'Ball Ground Police Department',
        contact_info: 'Officer Chen - 770-555-0234',
        is_public: true
      },
      {
        type: 'vehicle',
        priority: 'immediate',
        subject_name: 'Unknown',
        subject_description: 'White male, approximately 30-40 years old, baseball cap',
        vehicle_make: 'Ford',
        vehicle_model: 'F-150',
        vehicle_year: '2018',
        vehicle_color: 'Red',
        license_plate: 'Partial: GH?-4??3',
        vehicle_features: 'Lifted suspension, oversized tires, toolbox in bed',
        direction_of_travel: 'Northbound on I-575',
        incident_date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        incident_location: 'Highway 20 and I-575',
        last_known_location: 'Northbound I-575 near Exit 14',
        jurisdiction: 'Multi-County',
        title: 'Hit and Run - Red Ford F-150',
        summary: 'Vehicle involved in hit and run with injuries. Failed to stop at scene.',
        narrative: 'A red Ford F-150 struck a motorcyclist on Highway 20 near I-575 and fled the scene. The motorcyclist sustained serious injuries. Witnesses report the truck was speeding and may have been intentional. The vehicle has front-end damage and possibly a broken headlight. Driver is a white male wearing a baseball cap.',
        officer_safety_info: 'Driver exhibited aggressive behavior and should be approached with caution.',
        approach_instructions: 'Conduct high-risk vehicle stop if located. Driver may be impaired or aggressive.',
        agency_name: 'Georgia State Patrol',
        contact_info: 'Trooper Martinez - 770-555-0567',
        is_public: true
      },
      {
        type: 'person',
        priority: 'immediate',
        subject_name: 'Sophia Kim',
        subject_aliases: ['Sophie'],
        subject_description: 'Asian female, 4\'2", 65 lbs, black hair in pigtails',
        date_of_birth: '2014-09-12',
        age_range: '9-10',
        height: '4\'2"',
        weight: '65 lbs',
        hair_color: 'Black',
        eye_color: 'Brown',
        distinguishing_features: 'Missing front tooth, pink glasses',
        last_seen_wearing: 'Purple jacket with unicorn design, pink leggings, light-up sneakers',
        armed_dangerous: false,
        incident_date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        incident_location: 'Etowah River Park, Canton, GA',
        last_known_location: 'Etowah River Park playground area',
        jurisdiction: 'Cherokee County',
        title: 'Missing Child - Sophia Kim - URGENT',
        summary: '9-year-old girl missing from park. Was playing on playground when she disappeared.',
        narrative: 'Sophia Kim was playing at Etowah River Park with her family. Her mother looked away briefly to attend to another child, and when she looked back, Sophia was gone. Extensive search of the park and surrounding area has been unsuccessful. Sophia is shy and unlikely to go with strangers willingly. K9 units lost her scent near the parking area.',
        officer_safety_info: 'Time is critical in missing child cases. All available units requested to assist.',
        approach_instructions: 'If located, verify identity and immediately contact command post at the park.',
        agency_name: 'Cherokee Sheriff\'s Office',
        contact_info: 'Lieutenant Park - 770-555-0890',
        is_public: true
      }
    ];
    
    console.log(`Creating ${sampleBOLOs.length} sample BOLOs...`);
    
    for (const boloData of sampleBOLOs) {
      try {
        // Generate case number
        const caseResult = await client.query('SELECT generate_bolo_case_number() as case_number');
        const caseNumber = caseResult.rows[0].case_number;
        
        // Process aliases if present
        let subjectAliases = null;
        if (boloData.subject_aliases) {
          subjectAliases = Array.isArray(boloData.subject_aliases) 
            ? boloData.subject_aliases 
            : [boloData.subject_aliases];
        }
        
        // Insert BOLO
        await client.query(`
          INSERT INTO bolos (
            case_number, type, priority, status,
            subject_name, subject_aliases, subject_description,
            date_of_birth, age_range, height, weight,
            hair_color, eye_color, distinguishing_features,
            last_seen_wearing, armed_dangerous, armed_dangerous_details,
            vehicle_make, vehicle_model, vehicle_year, vehicle_color,
            license_plate, vehicle_vin, vehicle_features, direction_of_travel,
            incident_date, incident_location, last_known_location, jurisdiction,
            title, summary, narrative, officer_safety_info, approach_instructions,
            created_by, agency_name, officer_name, contact_info,
            is_public, expires_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38, $39, $40
          )
        `, [
          caseNumber,
          boloData.type,
          boloData.priority,
          'active',
          boloData.subject_name || null,
          subjectAliases,
          boloData.subject_description || null,
          boloData.date_of_birth || null,
          boloData.age_range || null,
          boloData.height || null,
          boloData.weight || null,
          boloData.hair_color || null,
          boloData.eye_color || null,
          boloData.distinguishing_features || null,
          boloData.last_seen_wearing || null,
          boloData.armed_dangerous || false,
          boloData.armed_dangerous_details || null,
          boloData.vehicle_make || null,
          boloData.vehicle_model || null,
          boloData.vehicle_year || null,
          boloData.vehicle_color || null,
          boloData.license_plate || null,
          boloData.vehicle_vin || null,
          boloData.vehicle_features || null,
          boloData.direction_of_travel || null,
          boloData.incident_date || new Date(),
          boloData.incident_location || null,
          boloData.last_known_location || null,
          boloData.jurisdiction || null,
          boloData.title,
          boloData.summary,
          boloData.narrative || null,
          boloData.officer_safety_info || null,
          boloData.approach_instructions || null,
          userId,
          boloData.agency_name || 'Cherokee Sheriff\'s Office',
          'System',
          boloData.contact_info || null,
          boloData.is_public || false,
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Expires in 30 days
        ]);
        
        console.log(`✓ Created BOLO: ${boloData.title}`);
      } catch (error) {
        console.error(`Error creating BOLO "${boloData.title}":`, error.message);
      }
    }
    
    console.log('\nSample BOLOs created successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

// Run the script
createSampleBOLOs();