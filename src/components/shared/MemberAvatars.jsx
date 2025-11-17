import { useTheme } from '../../contexts/ThemeContext'

/**
 * Gemeinsame Avatar-Liste für geteilte Listen
 * Zeigt bis zu maxDisplay Avatare + "+N" Badge für weitere
 */
function MemberAvatars({ members = [], maxDisplay = 4, size = 24, showLabel = true }) {
  const { isDark } = useTheme()
  
  if (!members || members.length === 0) return null

  const displayMembers = members.slice(0, maxDisplay)
  const remainingCount = Math.max(0, members.length - maxDisplay)
  const totalCount = members.length

  return (
    <div className="flex items-center gap-2">
      {/* Avatar Stack */}
      <div className="flex -space-x-2">
        {displayMembers.map((member, idx) => {
          const isOwner = member.role === 'owner'
          
          return (
            <div
              key={member.id}
              className={`rounded-full border-2 overflow-hidden ${
                isDark ? 'border-gray-800' : 'border-white'
              } ${isOwner ? 'ring-2 ring-blue-500' : ''}`}
              style={{ 
                width: `${size}px`, 
                height: `${size}px`,
                zIndex: maxDisplay - idx 
              }}
              title={`${member.display_name || member.username}${isOwner ? ' (Owner)' : ''}`}
            >
              {member.avatar_url ? (
                <img 
                  src={member.avatar_url} 
                  alt={member.display_name || member.username} 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div 
                  className={`w-full h-full flex items-center justify-center font-bold ${
                    isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'
                  }`}
                  style={{ fontSize: `${size * 0.4}px` }}
                >
                  {(member.display_name || member.username || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          )
        })}
        
        {/* +N Badge */}
        {remainingCount > 0 && (
          <div 
            className={`rounded-full border-2 flex items-center justify-center font-semibold ${
              isDark 
                ? 'border-gray-800 bg-gray-700 text-gray-300' 
                : 'border-white bg-gray-200 text-gray-700'
            }`}
            style={{ 
              width: `${size}px`, 
              height: `${size}px`,
              fontSize: `${size * 0.4}px`,
              zIndex: 0
            }}
            title={`${remainingCount} weitere ${remainingCount === 1 ? 'Mitglied' : 'Mitglieder'}`}
          >
            +{remainingCount}
          </div>
        )}
      </div>

      {/* Label */}
      {showLabel && (
        <span 
          className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
          aria-label={`${totalCount} ${totalCount === 1 ? 'Mitglied' : 'Mitglieder'}`}
        >
          {totalCount} {totalCount === 1 ? 'Mitglied' : 'Mitglieder'}
        </span>
      )}
    </div>
  )
}

export default MemberAvatars







