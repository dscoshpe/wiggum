--[[
	Nelson v2.1.0
	A wrapper for inline analysis of traffic in Tshark/Wireshark with Lua
	(c) 2012-2014, Walter Hanau
	
	TODO:
		- perhaps clarify the nelson register object names
		- make the nelson register easier to use: use aliases or do searching of dissector tables?
--]]

-- declare the "nelson" protocol which wraps the analyzed protocols
local nelson = Proto("nelson", "inline traffic analysis wrapper")

-- these are used to cache the Wireshark 'dissectors' and Lua 'analyzers'
local dissectors = {}
local analyzers = {}

-- browsing the source code is a good way to get dissector information:
-- https://anonsvn.wireshark.org/wireshark/trunk/epan/dissectors/
local regInfo = {}
function nelsonRegister(info)
	table.insert(regInfo, info)
end

-- If a specific dissector can't be found or if the intercepting dissector is
-- the last one called in the dissection chain the null dissector is used to
-- gracefully pass control to the user's analyzer.
local nullDissector = {
	call = function() end
}

-- This function reliably inserts an analyzer (supplied to Nelson by user) at a
-- specific place in a dissector table. Existing dissector is cached and gets
-- run immediately before the analyzer so that the dissector's fields are
-- available to the analyzer.
local isInit = false
function nelson.init()
	-- if we previously set everything up then dont do it again
	if isInit then return end
	isInit = true
    
    -- loop through the list of analyzer registrations
    for i,reg in pairs(regInfo) do
		-- init local cache if this dissector table hasn't been referenced yet
		analyzers[reg.dt_enum] = analyzers[reg.dt_enum] or {}
		dissectors[reg.dt_enum] = dissectors[reg.dt_enum] or {}
		
		-- grab a reference to the dissector table thats called for
		local dt = DissectorTable.get(reg.dt_name)
		
		-- loop through the values list and create/cache as needed
		for i,value in pairs(reg.dt_values) do
			-- cache the analyzer
			analyzers[reg.dt_enum][value] = reg.analyzer
			-- cache the dissector; fall back to the null dissector
			dissectors[reg.dt_enum][value] = dt:get_dissector(value) or nullDissector
			-- replace the dissector entry with Nelson
			dt:add(value, nelson)
		end
    end
end

-- This function gets inserted in to dissector tables and called by the
-- active dissection as needed. In order to call the correct analyzer both the
-- 'pinfo.ipproto' and 'pinfo.match' variables are used where 'ipproto' is the
-- enumeration from the next higher level dissector table and 'match' is the
-- enumeration from the current dissector table. 'ipproto' implies and is
-- documented as being IP only however that seems to be incorrect.
function nelson.dissector(tvb, pinfo, tree)
    -- pinfo.match could change when other dissectors are run so save it
    local thisEnum = pinfo.match
    local parentEnum = pinfo.ipproto
    -- call the original dissector that we cached
    dissectors[parentEnum][thisEnum]:call(tvb, pinfo, tree)
    -- call the requested analyzer
    analyzers[parentEnum][thisEnum](tvb, pinfo, tree)
end
