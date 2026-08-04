var express = require("express");
var app = express();
app.listen(2004, function () {
    console.log("Server Started on port 2004");
})
app.use(express.urlencoded(true));
app.use(express.static("public"));
var fileuploader = require("express-fileupload");
app.use(fileuploader());
var cloudinary = require("cloudinary").v2;
var mysql = require("mysql2");
require('dotenv').config();
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API,
    api_secret: process.env.CLOUD_KEY
});
let url = process.env.AIVEN_URL;
let mysqlCon = mysql.createConnection(url);
mysqlCon.connect(function (err) {
    if (err == null)
        console.log("Connected Successssfullllyyyyy");
    else
        console.log(err.message);
})
//--------------------------------------------//
var nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS
    }
});

transporter.verify((err, success) => {
    if (err) {
        console.log("SMTP Error:", err);
    } else {
        console.log("SMTP Server Ready");
    }
});
//-----------------------------------------------------------------//

app.get("/", function (req, resp) {
    var path = __dirname + "/public/index.html";
    resp.sendFile(path);
})
//-------------------------------------------------------------//
app.post("/signup", function (req, resp) {
    let email = req.body.txtEmail;
    let password = req.body.txtPwd;
    let usertype = req.body.utype;
    mysqlCon.query(
        "INSERT INTO users VALUES(?,?,?,CURDATE(),1)",
        [email, password, usertype],
        function (err) {
            if (err) {
                console.log(err);
                return resp.send(err.message);
            }
            let mailOptions = {
                from: process.env.EMAIL,
                to: email,
                subject: "Welcome to CareConnect",
                html: `
                    <h2>Hello ${email}</h2>
                    <p>Your account has been created successfully.</p>
                    <br>
                    <b>Thank you for registering with CareConnect.</b>
                `
            };
            transporter.sendMail(mailOptions, function (err, info) {
                if (err) {
                    console.log("Mail Error:", err);
                    return resp.send("User Registered but Email Not Sent");
                }
                console.log("Mail Sent:", info.response);
                resp.send("success");
            });
        }
    );
});
app.post("/login", function (req, res) {
    let email = req.body.txtEmail;
    let pwd = req.body.txtPwd;
    mysqlCon.query(
        "SELECT * FROM users WHERE email=? AND password=?",
        [email, pwd],
        function (err, result) {
            if (err) {
                res.send("Error");
                return;
            }
            if (result.length == 0) {
                res.send("Invalid");
                return;
            }
            // Check Block/Unblock
            if (result[0].aactive == 0) {
                res.send("Blocked");
                return;
            }

            // status == 1
            res.send(result[0].utype);
        }
    );
});
app.get("/checkEmail", function (req, resp) {

    let email = req.query.txtEmail;

    mysqlCon.query(
        "select * from users where email=?",
        [email],
        function (err, result) {

            if (err)
                resp.send(err.message);
            else if (result.length > 0)
                resp.send("Already Exists");
            else
                resp.send("Available");
        }
    );
});
//-------------------------------Donor Profile Page----------------------------------------------------------------//
app.get("/donor_page", function (req, resp) {
    var path = __dirname + "/public/dprofile.html";
    resp.sendFile(path);
});

app.post("/dprofile", async function (req, resp) {
    let email = req.body.txtEmail;
    let name = req.body.txtName;
    let mobile = req.body.txtMobile;
    let address = req.body.txtAddress;
    let city = req.body.txtCity;
    let aadhar = req.files.aadhar;
    let profile = req.files.profile;
    let aadhar_url = "nopic.jpg";
    let profile_url = "nopic.jpg";
    if (aadhar != null) {
        let aadharName = aadhar.name;
        let fullPath = __dirname + "/uploads/" + aadharName;
        await aadhar.mv(fullPath);
        await cloudinary.uploader.upload(fullPath).then(function (picUrlResult) {
            aadhar_url = picUrlResult.url;   //will give u the url of ur pic on cloudinary server
        });
    }
    if (profile != null) {
        let profileName = profile.name;
        let fullPath = __dirname + "/uploads/" + profileName;
        await profile.mv(fullPath);
        await cloudinary.uploader.upload(fullPath).then(function (picUrlResult) {
            profile_url = picUrlResult.url;   //will give u the url of ur pic on cloudinary server
        });
    }
    mysqlCon.query("insert into dprofiles values(?,?,?,?,?,?,?)", [email, name, mobile, address, city, aadhar_url, profile_url], function (err) {
        if (err == null)
            resp.sendFile(__dirname + "/public/response_save.html");
        else
            resp.send(err.message);
    })
})
app.post("/getDetails", async function (req, resp) {
    let email = req.body.txtEmail;
    mysqlCon.query("select * from dprofiles where email=?", [email], function (err, result) {
        if (err == null)
            resp.send(result);
        else
            resp.send("Invalid Email id");
    })
})

app.post("/update_profile", async function (req, resp) {
    let email = req.body.txtEmail;
    let name = req.body.txtName;
    let mobile = req.body.txtMobile;
    let address = req.body.txtAddress;
    let city = req.body.txtCity;
    let aadhar_url = req.body.hdn1;
    let profile_url = req.body.hdn2;
    if (req.files && req.files.aadhar) {
        let aadhar = req.files.aadhar;
        let fullPath = __dirname + "/uploads/" + aadhar.name;
        await aadhar.mv(fullPath);
        let result = await cloudinary.uploader.upload(fullPath);
        aadhar_url = result.url;
    }
    if (req.files && req.files.profile) {
        let profile = req.files.profile;
        let fullPath = __dirname + "/uploads/" + profile.name;
        await profile.mv(fullPath);
        let result = await cloudinary.uploader.upload(fullPath);
        profile_url = result.url;
    }

    mysqlCon.query(
        "update dprofiles set name=?, mobile=?, address=?, city=?, acardpath=?, picpath=? where email=?",
        [name, mobile, address, city, aadhar_url, profile_url, email],
        function (err) {
            if (err)
                resp.send(err.message);
            else
                resp.redirect("/response_save.html");   // or resp.sendFile(...)
        }
    );
});

//-------------------------------Avail Medicine Page----------------------------------------------------------------//
app.get("/avail_medicine", function (req, resp) {
    var path = __dirname + "/public/availmed.html";
    resp.sendFile(path);
});
app.post("/availprofile", async function (req, resp) {
    let email = req.body.txtEmail;
    let medicine = req.body.txtMedicine;
    let expiry = req.body.txtExpiry;
    let company = req.body.txtCompany;
    let packing = req.body.ptype;
    let quantity = req.body.txtQty;
    let info = req.body.txtOther;
    let medpic = req.files.medpic;
    let med_url = "nopic.jpg";
    if (medpic != null) {
        let medName = medpic.name;
        let fullPath = __dirname + "/uploads/" + medName;
        await medpic.mv(fullPath);
        await cloudinary.uploader.upload(fullPath).then(function (picUrlResult) {
            med_url = picUrlResult.url;   //will give u the url of ur pic on cloudinary server
        });
    }
    mysqlCon.query("insert into medicines values(NULL,?,?,?,?,?,?,?,?)", [email, medicine, expiry, company, packing, quantity, info, med_url], function (err) {
        if (err == null)
            resp.sendFile(__dirname + "/public/response_save.html");
        else
            resp.send(err.message);
    })

})
//-------------------------------Avail Equipment Page----------------------------------------------------------------//
app.get("/avail_equipment", function (req, resp) {
    var path = __dirname + "/public/equipment.html";
    resp.sendFile(path);
});
app.post("/equipment", async function (req, resp) {
    let email = req.body.txtEmail;
    let equipment = req.body.txtEquip;
    let condition = req.body.condition;
    let type = req.body.type;
    let amt = req.body.txtAmt;
    let info = req.body.txtInfo
    let pic1 = req.files.pic1;
    let pic2 = req.files.pic2;
    let pic1_url = "nopic.jpg";
    let pic2_url = "nopic.jpg";
    if (type === "Donation") amt = 0;
    if (pic1 != null) {
        let picName = pic1.name;
        let fullPath = __dirname + "/uploads/" + picName;
        await pic1.mv(fullPath);
        await cloudinary.uploader.upload(fullPath).then(function (picUrlResult) {
            pic1_url = picUrlResult.url;   //will give u the url of ur pic on cloudinary server
        });
    }
    if (pic2 != null) {
        let pic2Name = pic2.name;
        let fullPath = __dirname + "/uploads/" + pic2Name;
        await pic2.mv(fullPath);
        await cloudinary.uploader.upload(fullPath).then(function (picUrlResult) {
            pic2_url = picUrlResult.url;   //will give u the url of ur pic on cloudinary server
        });
    }

    mysqlCon.query("insert into equipments values(NULL,?,?,?,?,?,?,?,?)", [email, equipment, condition, type, amt, pic1_url, pic2_url, info], function (err) {
        if (err == null)
            resp.sendFile(__dirname + "/public/response_save.html");
        else
            resp.send(err.message);
    })

})


//------------------------------------------------------------//
app.get("/admin_donor_dashboard", function (req, resp) {
    var path = __dirname + "/public/admin_donor_dash.html";
    resp.sendFile(path);
})
app.get("/admin_needy_dashboard", function (req, resp) {
    var path = __dirname + "/public/admin_needy_dash.html";
    resp.sendFile(path);
})
app.get("/admin_ngo_dashboard", function (req, resp) {
    var path = __dirname + "/public/admin_ngo_dash.html";
    resp.sendFile(path);
})
app.get("/admin_user_dashboard", function (req, resp) {
    var path = __dirname + "/public/admin_user_dash.html";
    resp.sendFile(path);
})
app.get("/fetch-all", function (req, resp) {
    mysqlCon.query("select * from dprofiles ", function (err, resultJSONAry) {
        if (err == null) {
            resp.send(resultJSONAry)
        }
        else
            resp.send(err.message);
    })
})
app.get("/fetch-all_needy", function (req, resp) {
    mysqlCon.query("select * from needyprofile ", function (err, resultJSONAry) {
        if (err == null) {
            resp.send(resultJSONAry)

        }
        else
            resp.send(err.message);
    })
})
app.get("/fetch-all_ngo", function (req, resp) {
    mysqlCon.query("select * from ngo ", function (err, resultJSONAry) {
        if (err == null) {
            resp.send(resultJSONAry)

        }
        else
            resp.send(err.message);
    })
})
app.get("/fetch-all-user", function (req, resp) {
    mysqlCon.query("select * from users ", function (err, resultJSONAry) {
        if (err == null) {
            resp.send(resultJSONAry)

        }
        else
            resp.send(err.message);
    })
})
app.get("/fetch_medicine_admin", function (req, resp) {
    mysqlCon.query("select * from medicines", function (err, resultJSONAry) {
        if (err == null) {
            resp.send(resultJSONAry)
        }
        else
            resp.send(err.message);
    })
})
app.get("/fetch_equip_admin", function (req, resp) {
    mysqlCon.query("select * from equipments", function (err, resultJSONAry) {
        if (err == null) {
            resp.send(resultJSONAry)
        }
        else
            resp.send(err.message);
    })
})
app.get("/delete-user", function (req, resp) {
    let email = req.query.email;
    mysqlCon.query(
        "delete from users where email=?",
        [email],
        function (err, result) {
            if (err)
                resp.send(err.message);
            else
                resp.send("User Deleted Successfully");
        });
});
app.get("/block-user", function (req, resp) {
    let email = req.query.email;
    let status = req.query.status;
    mysqlCon.query(
        "update users set aactive=? where email=?",
        [status, email],
        function (err, result) {
            if (err)
                resp.send(err.message);
            else {
                if (status == 0)
                    resp.send("User Blocked Successfully");
                else
                    resp.send("User Unblocked Successfully");
            }
        });
});
app.get("/donor_dashboard", function (req, resp) {
    var path = __dirname + "/public/dash_donor.html";
    resp.sendFile(path);
})

app.get("/setting", async function (req, resp) {

});

app.get("/getMedicinesData", function (req, resp) {
    let email = req.query.email;
    mysqlCon.query(
        "SELECT rid, medname, expdate, qty, packing FROM medicines WHERE email=?",
        [email],
        function (err, result) {
            if (err)
                resp.send(err);
            else
                resp.send(result);
        }
    );

});

app.get("/getEquipmentsData", function (req, resp) {
    let email = req.query.email;
    mysqlCon.query(
        "SELECT rid, equipment, atype, amount FROM equipments WHERE email=?",
        [email],
        function (err, result) {
            if (err)
                resp.send(err);
            else
                resp.send(result);
        }
    );
});
app.get("/deleterecord", function (req, resp) {
    let rid = req.query.rid;
    mysqlCon.query(
        "DELETE FROM equipments WHERE rid=?",
        [rid],
        function (err, result) {
            if (err)
                resp.send(err.message);
            else
                resp.send("Deleted Successfully");
        });
});
app.get("/deletedata", function (req, resp) {
    let rid = req.query.email;
    mysqlCon.query(
        "DELETE FROM medicines WHERE rid=?",
        [rid],
        function (err, result) {
            if (err)
                resp.send(err.message);
            else
                resp.send("User Deleted Successfully");
        });
});
app.get("/fetch_medicine", function (req, resp) {
    let email = req.query.txtEmail;
    mysqlCon.query(
        "SELECT * FROM medicines WHERE email=?",
        [email],
        function (err, result) {

            if (err)
                res.send(err);
            else
                res.send(result);
        })
})

app.get("/fetch_equipment", function (req, resp) {
    mysqlCon.query("select * from equipments", function (err, resultJSONAry) {
        if (err == null) {
            resp.send(resultJSONAry)
        }
        else
            resp.send(err.message);
    })
})

app.get("/update-password", function (req, resp) {
    let email = req.query.emailKuch;
    let oldPwd = req.query.oldPwdKuch;
    let newPwd = req.query.newPwdKuch;


    mysqlCon.query(
        "update users set password=? where email=? and password=?",
        [newPwd, email, oldPwd],
        function (err, result) {
            if (err == null) {
                if (result.affectedRows == 1)
                    resp.send("Password Updated Successfully...");
                else
                    resp.send("Invalid Email or Existing Password");
            }
            else
                resp.send(err.message);
        }
    );
});
//-----------------------------------------------------------
app.get("/admin_dashboard", function (req, resp) {
    var path = __dirname + "/public/dash_admin.html";
    resp.sendFile(path);
})

//----------------------------------------------------------
app.get("/med_finder", function (req, resp) {
    var path = __dirname + "/public/medFinder.html";
    resp.sendFile(path);
})
app.get("/fetch_distinct_cities", function (req, resp) {
    mysqlCon.query("select distinct city from dprofiles", function (err, resultJSONAry) {
        if (err == null) {
            console.log(resultJSONAry)
            resp.send(resultJSONAry)
        }
        else
            resp.send(err.message);
    })
})

app.get("/fetch_distinct_med", function (req, resp) {
    let city = req.query.city;
    let query = "SELECT DISTINCT medicines.medname FROM medicines INNER JOIN dprofiles ON medicines.email = dprofiles.email WHERE dprofiles.city = ? ;"
    mysqlCon.query(query, [city], function (err, result) {
        if (err)
            resp.send(err);
        else
            resp.send(result);
    });
});

app.get("/fetch_details", function (req, resp) {
    let city = req.query.city;
    let medicine = req.query.medicine;

    mysqlCon.query("select  medicines.picurl,medicines.medname,medicines.expdate,medicines.qty,medicines.packing,dprofiles.picpath,dprofiles.name,dprofiles.mobile,dprofiles.city,dprofiles.address,medicines.email from medicines inner join dprofiles  ON medicines.email = dprofiles.email  where dprofiles.city = ? and  medicines.medname = ?; ", [city, medicine], function (err, resultJSONAry) {
        if (err == null) {
            console.log(resultJSONAry)
            resp.send(resultJSONAry)
        }
        else
            resp.send(err.message);
    })
})
//--------------------------------------NGO Profile---------------------------------------------
app.get("/ngo_reg", function (req, resp) {
    var path = __dirname + "/public/NGOprofile.html";
    resp.sendFile(path);
});
app.post("/ngo_profile", async function (req, resp) {
    let email = req.body.txtEmail;
    let ngo_name = req.body.txtNGO;
    let address = req.body.txtAddress;
    let city = req.body.txtCity;
    let website = req.body.txtWeb;
    let mobile = req.body.txtMobile;
    let established = req.body.txtDate;
    let name = req.body.txtName;
    let info = req.body.txtInfo;
    let reg_number = req.body.txtNumber;
    let proofpic = req.files.proofpic;
    let pic_url = "nopic.jpg";
    if (proofpic != null) {
        let medName = proofpic.name;
        let fullPath = __dirname + "/uploads/" + medName;
        await proofpic.mv(fullPath);
        await cloudinary.uploader.upload(fullPath).then(function (picUrlResult) {
            pic_url = picUrlResult.url;   //will give u the url of ur pic on cloudinary server
        });
    }
    mysqlCon.query("insert into ngo values(?,?,?,?,?,?,?,?,?,?,?)", [email, ngo_name, address, city, website, mobile, established, name, info, reg_number, pic_url], function (err) {
        if (err == null)
            resp.sendFile(__dirname + "/public/response_save.html");
        else
            resp.send(err.message);
    })

})
//--------------------------------------------------------------------------------------//
app.get("/equip_finder", function (req, resp) {
    var path = __dirname + "/public/equipmentFinder.html";
    resp.sendFile(path);
})

app.get("/fetch_distinct_cities2", function (req, resp) {
    mysqlCon.query("select distinct city from dprofiles", function (err, resultJSONAry) {
        if (err == null) {
            console.log(resultJSONAry)
            resp.send(resultJSONAry)
        }
        else
            resp.send(err.message);
    })
})
app.get("/fetch_distinct_equip", function (req, resp) {

    let city = req.query.city;

    mysqlCon.query(
        `SELECT DISTINCT equipments.equipment
         FROM equipments
         INNER JOIN dprofiles
         ON equipments.email = dprofiles.email
         WHERE dprofiles.city=?`,
        [city],
        function (err, result) {

            if (err)
                resp.send(err.message);
            else
                resp.send(result);
        }
    );
});
app.get("/fetch_details_equip", function (req, resp) {
    let city = req.query.city;
    let equipment = req.query.equipment;

    mysqlCon.query(
        `SELECT
            equipments.pic1path,
            equipments.equipment,
            equipments.conditions,
            equipments.atype,
            equipments.amount,
            equipments.info,
           
            dprofiles.name,
            dprofiles.mobile,
            dprofiles.email,
            dprofiles.city,
            dprofiles.address
        FROM equipments
        INNER JOIN dprofiles
        ON equipments.email = dprofiles.email
        WHERE dprofiles.city = ? AND equipments.equipment = ?`,
        [city, equipment],
        function (err, resultJSONAry) {
            if (err)
                resp.send(err.message);
            else
                resp.send(resultJSONAry);
        }
    );
});
//-------------------------------------------------------//

app.get("/ngo_finder", function (req, resp) {
    var path = __dirname + "/public/NGOFinder.html";
    resp.sendFile(path);
})

app.get("/fetch_distinct_cities_ngo", function (req, resp) {
    mysqlCon.query("select distinct city from dprofiles", function (err, resultJSONAry) {
        if (err == null) {
            console.log(resultJSONAry)
            resp.send(resultJSONAry)
        }
        else
            resp.send(err.message);
    })
})
app.get("/fetch_ngo_details", function (req, resp) {
    let city = req.query.city;
    mysqlCon.query(
        "SELECT * FROM ngo WHERE city=?",
        [city],
        function (err, result) {

            if (err == null)
                resp.send(result);
            else
                resp.send(err.message);

        });
});
//----------------------------------------------------------------------------//
app.get("/needy_profile", function (req, resp) {
    var path = __dirname + "/public/needyprofile.html";
    resp.sendFile(path);
})
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(" AQ.Ab8RN6LMMin2eQ-uHO8tObNzdzqaBizQbppVVSJJNpwR-j9eoQ");
const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
async function ConnectGemini(frontUrl, backUrl) {
    const myprompt = "These are the front and back images of the same Aadhaar card.Extract all information from both images and return one JSON object.Read the text on picture and tell all the information in adhaar card and give output STRICTLY in JSON format:aadhaar_number: '',name: '',gender: '',dob: '',address: ''. Dont give output as string.Return DOB strictly in YYYY-MM-DD format."
    const frontResp = await fetch(frontUrl)
        .then((response) => response.arrayBuffer());
    const backResp = await fetch(backUrl)
        .then((response) => response.arrayBuffer());
    const result = await model.generateContent([
        {
            inlineData: {
                data: Buffer.from(frontResp).toString("base64"),
                mimeType: "image/jpeg",
            },
        },
        {
            inlineData: {
                data: Buffer.from(backResp).toString("base64"),
                mimeType: "image/jpeg",
            },
        },
        myprompt,
    ]);
    console.log(result.response.text())

    const cleaned = result.response.text().replace(/```json|```/g, '').trim();
    const jsonData = JSON.parse(cleaned);
    console.log(jsonData);

    return jsonData

}
app.post("/ai-read-pic", async function (req, resp) {
    let jsonResultFromAi;
    let msg = "File not Uploaded";

    let frontUrl = "";
    let backUrl = "";
    if (!req.files || !req.files.pic1 || !req.files.pic2) {
        return resp.send("Please upload both Aadhaar images.");
    }
    let frontFile = req.files.pic1;
    let backFile = req.files.pic2;
    let frontPath = __dirname + "/uploads/" + frontFile.name;
    await frontFile.mv(frontPath);
    let backPath = __dirname + "/uploads/" + backFile.name;
    await backFile.mv(backPath);
    msg = "Uploaded Successfully";
    let frontResult = await cloudinary.uploader.upload(frontPath);
    let backResult = await cloudinary.uploader.upload(backPath);

    frontUrl = frontResult.url;
    backUrl = backResult.url;

    jsonResultFromAi = await ConnectGemini(frontUrl, backUrl);

    let name = jsonResultFromAi.name;
    let aadhaar = jsonResultFromAi.aadhaar_number;
    let gender = jsonResultFromAi.gender;
    let dob = jsonResultFromAi.dob;
    let address = jsonResultFromAi.address;
    let email = req.body.txtEmail;
    let mobile = req.body.txtMobile;
    console.log(name);
    console.log(aadhaar);
    console.log(gender);
    console.log(dob);
    console.log(address);
    console.log(email);
    console.log(mobile);
    mysqlCon.query("insert into needyprofile values(?,?,?,?,?,?,?,?,?,?)", [null, email, name, mobile, frontUrl, backUrl, aadhaar, address, gender, dob], function (err) {
        if (err == null)
            resp.sendFile(__dirname + "/public/response_save.html");
        else
            resp.send(err.message);
    })
})
//-----------------------------------------//
app.get("/ngo_dashboard", function (req, resp) {
    var path = __dirname + "/public/dash_ngo.html";
    resp.sendFile(path);
});

app.get("/needy_dashboard", function (req, resp) {
    var path = __dirname + "/public/dash_needy.html";
    resp.sendFile(path);
});

