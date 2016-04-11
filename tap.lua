
-- need to use Nelson so that this script will run while capturing or reading
--local nelson = require("nelson")
dofile("nelson.lua")
local json = require("cjson") -- TODO: double check we get cjson in Wireshark

-- list of the names of the fields to export from wireshark
local fieldNames = {
	"frame.time_epoch", "frame.interface_id",
	"radiotap.dbm_antsignal", "radiotap.channel.freq", "radiotap.channel.type", "radiotap.mactime",
	"wlan.bssid", "wlan.ra", "wlan.da", "wlan.ta", "wlan.sa", "wlan.seq", "wlan.fcs_bad", "wlan.fc.type_subtype",
	"wlan_mgt.ssid", "wlan_mgt.fixed.beacon", "wlan_mgt.fixed.timestamp", "wlan_mgt.fixed.capabilities"
}

-- take a list of wireshark names and create a Field object for each in a table
local function initFields(names)
	local fieldTbl = {}
	
	for i,name in ipairs(names) do
		fieldTbl[name] = Field.new(name)
	end
	
	return fieldTbl
end

-- initialize the wireshark field names
local fields = initFields(fieldNames)

-- modified from: http://lua-users.org/wiki/SplitJoin
function string:split()
	local fields = {}
	self:gsub("([^.]+)", function(c) fields[#fields+1] = c end)
	return fields
end

-- applies a value to a nested table based on dotted string notation
local function applyNested(tbl, names, index, value)
	-- apply value to the table object when last name is reached
	if index == #names then
		tbl[names[index]] = tonumber(value) or value
	else
		-- otherwise, check the next table and dive another level
		if tbl[names[index]] == nil then
			tbl[names[index]] = {}
		end
		applyNested(tbl[names[index]], names, index + 1, value)
	end
end

-- takes the field info from wireshark and creates a JSON object
local function assemblePacket(names)
	local pkt = {}
	
	for key,value in ipairs(names) do
		if value.name:find(".", 1, true) then
			applyNested(pkt, value.name:split(), 1, tostring(value.value))
		end
	end
	
	return pkt
end

-- collect all field values, assemble to JSON, and pass to the tcp uploader
local function processPacket(tvb, pinfo, pmatch)

	-- do some sanity checks so that we don't export things we dont want
	--if (tostring(fields.wlan.check_fail()) == "1") then return end
	--if (tostring(fields.wlan.bssid()) == "ff:ff:ff:ff:ff:ff") then return end
	--if (tostring(fields.wlan.fctype()) == "0x1d") then return end -- ack
	
	print(json.encode(assemblePacket({all_field_infos()})))
end

-- register packet handlers with Nelson
nelsonRegister({
	-- WLAN Radiotap
	dt_name = "wtap_encap",
	dt_enum = 0,
	dt_values = {23},
	analyzer = processPacket
})

-- dummy listener so that we can print results at the end of the analysis
local tap = Listener.new(nil, nil)
function tap.draw()
	print("done!")
end




